"""SQLite persistence: documents, chunks, FTS5, and stub knowledge tables."""

from __future__ import annotations

import json
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator, Iterable

from app.database.models import ChunkRecord, DocumentRecord, DocumentStatus, utc_now_iso
from app.logging_config import get_logger

logger = get_logger(__name__)

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filepath TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    modified_at TEXT,
    ingested_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    year TEXT,
    module TEXT,
    document_type TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    heading TEXT,
    year TEXT,
    module TEXT,
    document_type TEXT,
    metadata_json TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_year ON documents(year);
CREATE INDEX IF NOT EXISTS idx_documents_module ON documents(module);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash);

CREATE TABLE IF NOT EXISTS ingestion_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    files_found INTEGER DEFAULT 0,
    processed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    chunks_created INTEGER DEFAULT 0,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    year TEXT,
    document_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    year TEXT,
    module TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS technologies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT
);

CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT
);

CREATE TABLE IF NOT EXISTS document_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    evidence_chunk_id TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assistant_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    kind TEXT DEFAULT 'explicit'
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    mode TEXT,
    sources_json TEXT,
    retrieval TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    chunk_id UNINDEXED,
    text,
    filename,
    heading,
    tokenize='porter unicode61'
);
"""


class SQLiteDatabase:
    """Thin wrapper around SQLite for the second brain."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False, timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA busy_timeout = 30000")
        return conn

    @contextmanager
    def connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = self._connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self.connection() as conn:
            conn.executescript(SCHEMA_SQL)
            # Migrate older contentless FTS tables (chunk_id was not persisted).
            row = conn.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='chunks_fts'"
            ).fetchone()
            sql = (row["sql"] or "") if row else ""
            if "content=''" in sql.replace(" ", ""):
                logger.warning("Migrating contentless chunks_fts table")
                conn.execute("DROP TABLE chunks_fts")
                conn.execute(
                    """
                    CREATE VIRTUAL TABLE chunks_fts USING fts5(
                        chunk_id UNINDEXED,
                        text,
                        filename,
                        heading,
                        tokenize='porter unicode61'
                    )
                    """
                )
                chunks = conn.execute(
                    "SELECT id, text, filename, heading FROM chunks"
                ).fetchall()
                for c in chunks:
                    conn.execute(
                        """
                        INSERT INTO chunks_fts (chunk_id, text, filename, heading)
                        VALUES (?, ?, ?, ?)
                        """,
                        (c["id"], c["text"], c["filename"], c["heading"] or ""),
                    )
            # Optional columns / tables for older DBs
            cols = {
                r["name"]
                for r in conn.execute("PRAGMA table_info(assistant_memory)").fetchall()
            }
            if "kind" not in cols:
                conn.execute(
                    "ALTER TABLE assistant_memory ADD COLUMN kind TEXT DEFAULT 'explicit'"
                )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    mode TEXT,
                    sources_json TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
                )
                """
            )
            msg_cols = {
                r["name"]
                for r in conn.execute("PRAGMA table_info(chat_messages)").fetchall()
            }
            if "retrieval" not in msg_cols:
                conn.execute("ALTER TABLE chat_messages ADD COLUMN retrieval TEXT")
        logger.info("SQLite schema ready at %s", self.db_path)

    # --- documents ---

    def get_document_by_path(self, filepath: str) -> DocumentRecord | None:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM documents WHERE filepath = ?", (filepath,)
            ).fetchone()
        return self._row_to_document(row) if row else None

    def get_document(self, document_id: int) -> DocumentRecord | None:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM documents WHERE id = ?", (document_id,)
            ).fetchone()
        return self._row_to_document(row) if row else None

    def list_documents(
        self,
        *,
        year: str | None = None,
        module: str | None = None,
        document_type: str | None = None,
        filename_query: str | None = None,
        status: str | None = None,
    ) -> list[DocumentRecord]:
        clauses: list[str] = []
        params: list[Any] = []
        if year:
            clauses.append("year = ?")
            params.append(year)
        if module:
            clauses.append("module = ?")
            params.append(module)
        if document_type:
            clauses.append("document_type = ?")
            params.append(document_type)
        if status:
            clauses.append("status = ?")
            params.append(status)
        if filename_query:
            clauses.append("filename LIKE ?")
            params.append(f"%{filename_query}%")

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        sql = f"SELECT * FROM documents {where} ORDER BY filepath"
        with self.connection() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_document(r) for r in rows]

    def upsert_document(
        self,
        *,
        filepath: str,
        filename: str,
        file_hash: str,
        file_size: int,
        file_type: str,
        modified_at: str | None,
        year: str | None,
        module: str | None,
        document_type: str | None,
        status: str = DocumentStatus.ACTIVE.value,
        error_message: str | None = None,
        chunk_count: int = 0,
    ) -> int:
        now = utc_now_iso()
        with self.connection() as conn:
            existing = conn.execute(
                "SELECT id FROM documents WHERE filepath = ?", (filepath,)
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE documents SET
                        filename=?, file_hash=?, file_size=?, file_type=?,
                        modified_at=?, ingested_at=?, status=?, year=?, module=?,
                        document_type=?, chunk_count=?, error_message=?
                    WHERE id=?
                    """,
                    (
                        filename,
                        file_hash,
                        file_size,
                        file_type,
                        modified_at,
                        now,
                        status,
                        year,
                        module,
                        document_type,
                        chunk_count,
                        error_message,
                        existing["id"],
                    ),
                )
                return int(existing["id"])

            cur = conn.execute(
                """
                INSERT INTO documents (
                    filepath, filename, file_hash, file_size, file_type,
                    modified_at, ingested_at, status, year, module,
                    document_type, chunk_count, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    filepath,
                    filename,
                    file_hash,
                    file_size,
                    file_type,
                    modified_at,
                    now,
                    status,
                    year,
                    module,
                    document_type,
                    chunk_count,
                    error_message,
                ),
            )
            return int(cur.lastrowid)

    def mark_document_unavailable(self, document_id: int) -> None:
        with self.connection() as conn:
            conn.execute(
                "UPDATE documents SET status=?, chunk_count=0 WHERE id=?",
                (DocumentStatus.UNAVAILABLE.value, document_id),
            )

    def mark_document_error(self, document_id: int | None, filepath: str, message: str) -> int:
        with self.connection() as conn:
            existing = conn.execute(
                "SELECT id FROM documents WHERE filepath = ?", (filepath,)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE documents SET status=?, error_message=?, ingested_at=? WHERE id=?",
                    (DocumentStatus.ERROR.value, message, utc_now_iso(), existing["id"]),
                )
                return int(existing["id"])
            # Minimal stub if never seen before
            cur = conn.execute(
                """
                INSERT INTO documents (
                    filepath, filename, file_hash, file_size, file_type,
                    ingested_at, status, error_message
                ) VALUES (?, ?, '', 0, 'unknown', ?, ?, ?)
                """,
                (
                    filepath,
                    Path(filepath).name,
                    utc_now_iso(),
                    DocumentStatus.ERROR.value,
                    message,
                ),
            )
            return int(cur.lastrowid)

    def delete_chunks_for_document(self, document_id: int) -> list[str]:
        """Delete chunks and FTS rows; return deleted chunk ids."""
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT id FROM chunks WHERE document_id = ?", (document_id,)
            ).fetchall()
            chunk_ids = [r["id"] for r in rows]
            for cid in chunk_ids:
                conn.execute("DELETE FROM chunks_fts WHERE chunk_id = ?", (cid,))
            conn.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
        return chunk_ids

    def insert_chunks(self, chunks: Iterable[dict[str, Any]]) -> int:
        count = 0
        with self.connection() as conn:
            for c in chunks:
                conn.execute(
                    """
                    INSERT INTO chunks (
                        id, document_id, chunk_index, text, filename, filepath,
                        page_start, page_end, heading, year, module,
                        document_type, metadata_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        c["id"],
                        c["document_id"],
                        c["chunk_index"],
                        c["text"],
                        c["filename"],
                        c["filepath"],
                        c.get("page_start"),
                        c.get("page_end"),
                        c.get("heading"),
                        c.get("year"),
                        c.get("module"),
                        c.get("document_type"),
                        json.dumps(c.get("metadata") or {}),
                    ),
                )
                conn.execute(
                    """
                    INSERT INTO chunks_fts (chunk_id, text, filename, heading)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        c["id"],
                        c["text"],
                        c["filename"],
                        c.get("heading") or "",
                    ),
                )
                count += 1
        return count

    def get_chunk(self, chunk_id: str) -> ChunkRecord | None:
        with self.connection() as conn:
            row = conn.execute("SELECT * FROM chunks WHERE id = ?", (chunk_id,)).fetchone()
        return self._row_to_chunk(row) if row else None

    def get_chunks_by_ids(self, chunk_ids: list[str]) -> list[ChunkRecord]:
        if not chunk_ids:
            return []
        placeholders = ",".join("?" * len(chunk_ids))
        with self.connection() as conn:
            rows = conn.execute(
                f"SELECT * FROM chunks WHERE id IN ({placeholders})", chunk_ids
            ).fetchall()
        by_id = {r["id"]: self._row_to_chunk(r) for r in rows}
        return [by_id[cid] for cid in chunk_ids if cid in by_id]

    def keyword_search(self, query: str, limit: int = 20) -> list[tuple[ChunkRecord, float]]:
        """FTS5 search. Returns (chunk, rank_score) where higher is better."""
        import re

        cleaned = query.strip()
        if not cleaned:
            return []

        stop = {
            "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "is", "are",
            "was", "were", "be", "been", "what", "which", "who", "how", "why", "when",
            "where", "did", "do", "does", "my", "me", "i", "we", "you", "about", "with",
            "from", "into", "that", "this", "these", "those", "as", "at", "by", "it",
        }
        raw_terms = re.findall(r"[A-Za-z0-9][A-Za-z0-9_./+-]*", cleaned)
        terms = [t for t in raw_terms if t.lower() not in stop and len(t) > 1]
        if not terms:
            terms = [t for t in raw_terms if len(t) > 1][:5]
        if not terms:
            return []

        # OR gives better recall for natural-language questions; exact tokens stay quoted.
        fts_query = " OR ".join(f'"{t}"' for t in terms)

        with self.connection() as conn:
            try:
                # Fetch ids/ranks first, then load chunk rows.
                fts_rows = conn.execute(
                    """
                    SELECT chunk_id, bm25(chunks_fts) AS rank
                    FROM chunks_fts
                    WHERE chunks_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (fts_query, limit),
                ).fetchall()
            except sqlite3.OperationalError as exc:
                logger.warning("FTS query failed for %r (%s): %s", query, fts_query, exc)
                return []

            results: list[tuple[ChunkRecord, float]] = []
            for fts_row in fts_rows:
                chunk_id = fts_row["chunk_id"]
                if not chunk_id:
                    continue
                row = conn.execute(
                    "SELECT * FROM chunks WHERE id = ?", (chunk_id,)
                ).fetchone()
                if not row:
                    continue
                # bm25 in SQLite FTS5: lower (more negative) is better → invert
                rank = float(fts_row["rank"])
                score = 1.0 / (1.0 + abs(rank))
                results.append((self._row_to_chunk(row), score))
            return results

    def list_modules(self, *, year: str | None = None) -> list[dict[str, Any]]:
        clauses = ["module IS NOT NULL", "status = 'active'"]
        params: list[Any] = []
        if year:
            clauses.append("year = ?")
            params.append(year)
        where = " AND ".join(clauses)
        with self.connection() as conn:
            rows = conn.execute(
                f"""
                SELECT module AS name, year, COUNT(*) AS document_count
                FROM documents
                WHERE {where}
                GROUP BY module, year
                ORDER BY year, module
                """,
                params,
            ).fetchall()
        return [dict(r) for r in rows]

    def sample_year_chunks(
        self,
        year: str,
        *,
        per_module: int = 2,
        max_chunks: int = 14,
    ) -> list[ChunkRecord]:
        """Pick early chunks across modules so year-overview answers see real coverage."""
        modules = self.list_modules(year=year)
        out: list[ChunkRecord] = []
        with self.connection() as conn:
            for mod in modules:
                name = mod.get("name")
                if not name:
                    continue
                mrows = conn.execute(
                    """
                    SELECT * FROM chunks
                    WHERE year = ? AND module = ?
                    ORDER BY chunk_index ASC, id ASC
                    LIMIT ?
                    """,
                    (year, name, per_module),
                ).fetchall()
                out.extend(self._row_to_chunk(r) for r in mrows)
                if len(out) >= max_chunks:
                    break
        return out[:max_chunks]

    def list_projects(self) -> list[dict[str, Any]]:
        """Heuristic: documents with document_type containing project/assignment."""
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT id, filename, filepath, year, module, document_type, chunk_count
                FROM documents
                WHERE status = 'active'
                  AND (
                    lower(document_type) LIKE '%project%'
                    OR lower(document_type) LIKE '%assignment%'
                    OR lower(filename) LIKE '%project%'
                    OR lower(filepath) LIKE '%project%'
                  )
                ORDER BY year, module, filename
                """
            ).fetchall()
        return [dict(r) for r in rows]

    def list_years(self) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT year AS name, COUNT(*) AS document_count
                FROM documents
                WHERE year IS NOT NULL AND status = 'active'
                GROUP BY year
                ORDER BY year
                """
            ).fetchall()
        return [dict(r) for r in rows]

    def upsert_module(self, name: str, year: str | None) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO modules (name, year, document_count)
                VALUES (?, ?, 1)
                ON CONFLICT(name) DO UPDATE SET
                    year = COALESCE(excluded.year, modules.year),
                    document_count = modules.document_count + 1
                """,
                (name, year),
            )

    def start_ingestion_run(self) -> int:
        with self.connection() as conn:
            cur = conn.execute(
                "INSERT INTO ingestion_history (started_at) VALUES (?)",
                (utc_now_iso(),),
            )
            return int(cur.lastrowid)

    def finish_ingestion_run(self, run_id: int, stats: dict[str, Any]) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                UPDATE ingestion_history SET
                    finished_at=?, files_found=?, processed=?, skipped=?,
                    updated=?, deleted=?, errors=?, chunks_created=?, notes=?
                WHERE id=?
                """,
                (
                    utc_now_iso(),
                    stats.get("files_found", 0),
                    stats.get("processed", 0),
                    stats.get("skipped", 0),
                    stats.get("updated", 0),
                    stats.get("deleted", 0),
                    stats.get("errors", 0),
                    stats.get("chunks_created", 0),
                    stats.get("notes"),
                    run_id,
                ),
            )

    def all_active_filepaths(self) -> set[str]:
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT filepath FROM documents WHERE status = 'active'"
            ).fetchall()
        return {r["filepath"] for r in rows}

    def add_memory(self, content: str, *, kind: str = "explicit") -> int:
        now = utc_now_iso()
        text = content.strip()
        if not text:
            return 0
        # Deduplicate near-identical memories
        with self.connection() as conn:
            existing = conn.execute(
                "SELECT id FROM assistant_memory WHERE lower(content) = lower(?) LIMIT 1",
                (text,),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE assistant_memory SET updated_at = ?, kind = COALESCE(kind, ?) WHERE id = ?",
                    (now, kind, existing["id"]),
                )
                return int(existing["id"])
            cur = conn.execute(
                "INSERT INTO assistant_memory (content, created_at, updated_at, kind) VALUES (?, ?, ?, ?)",
                (text, now, now, kind),
            )
            return int(cur.lastrowid)

    def list_memories(self, limit: int = 40) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT id, content, created_at, updated_at, kind
                FROM assistant_memory
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def search_memories(self, query: str, limit: int = 12) -> list[dict[str, Any]]:
        q = (query or "").strip().lower()
        if not q:
            return self.list_memories(limit=limit)
        tokens = [t for t in re.findall(r"[a-z0-9]{3,}", q) if t]
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT id, content, created_at, updated_at, kind FROM assistant_memory ORDER BY id DESC LIMIT 200"
            ).fetchall()
        scored: list[tuple[int, dict[str, Any]]] = []
        for r in rows:
            blob = (r["content"] or "").lower()
            score = sum(1 for t in tokens if t in blob) if tokens else 0
            if score or not tokens:
                scored.append((score, dict(r)))
        scored.sort(key=lambda x: (-x[0], -int(x[1]["id"])))
        return [item for _, item in scored[:limit]]

    def create_chat_session(self, session_id: str, title: str | None = None) -> dict[str, Any]:
        now = utc_now_iso()
        with self.connection() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO chat_sessions (id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (session_id, title or "New chat", now, now),
            )
            row = conn.execute(
                "SELECT id, title, created_at, updated_at FROM chat_sessions WHERE id = ?",
                (session_id,),
            ).fetchone()
        return dict(row)

    def touch_chat_session(self, session_id: str, title: str | None = None) -> None:
        now = utc_now_iso()
        with self.connection() as conn:
            if title:
                conn.execute(
                    "UPDATE chat_sessions SET updated_at = ?, title = COALESCE(NULLIF(?, ''), title) WHERE id = ?",
                    (now, title, session_id),
                )
            else:
                conn.execute(
                    "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
                    (now, session_id),
                )

    def list_chat_sessions(self, limit: int = 30) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT id, title, created_at, updated_at
                FROM chat_sessions
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_chat_messages(self, session_id: str, limit: int = 200) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT id, session_id, role, content, mode, sources_json, retrieval, created_at
                FROM chat_messages
                WHERE session_id = ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        out = []
        for r in rows:
            item = dict(r)
            raw = item.pop("sources_json", None)
            if raw:
                try:
                    item["sources"] = json.loads(raw)
                except json.JSONDecodeError:
                    item["sources"] = []
            else:
                item["sources"] = []
            out.append(item)
        return out

    def add_chat_message(
        self,
        session_id: str,
        *,
        role: str,
        content: str,
        mode: str | None = None,
        sources: list[dict[str, Any]] | None = None,
        retrieval: str | None = None,
    ) -> int:
        now = utc_now_iso()
        self.create_chat_session(session_id)
        title = None
        if role == "user" and content.strip():
            title = content.strip().replace("\n", " ")[:72]
        self.touch_chat_session(session_id, title=title)
        with self.connection() as conn:
            cur = conn.execute(
                """
                INSERT INTO chat_messages
                    (session_id, role, content, mode, sources_json, retrieval, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    role,
                    content,
                    mode,
                    json.dumps(sources or [], ensure_ascii=False) if sources is not None else None,
                    retrieval,
                    now,
                ),
            )
            return int(cur.lastrowid)

    def delete_chat_session(self, session_id: str) -> bool:
        with self.connection() as conn:
            conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
            cur = conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
            return bool(cur.rowcount)
    def clear_memories(self) -> int:
        with self.connection() as conn:
            cur = conn.execute("DELETE FROM assistant_memory")
            return int(cur.rowcount or 0)

    def delete_memories_matching(self, query: str) -> int:
        q = (query or "").strip().lower()
        if not q:
            return 0
        with self.connection() as conn:
            rows = conn.execute("SELECT id, content FROM assistant_memory").fetchall()
            ids = [r["id"] for r in rows if q in (r["content"] or "").lower()]
            for mid in ids:
                conn.execute("DELETE FROM assistant_memory WHERE id = ?", (mid,))
            return len(ids)

    @staticmethod
    def _row_to_document(row: sqlite3.Row) -> DocumentRecord:
        return DocumentRecord(
            id=row["id"],
            filepath=row["filepath"],
            filename=row["filename"],
            file_hash=row["file_hash"],
            file_size=row["file_size"],
            file_type=row["file_type"],
            modified_at=row["modified_at"],
            ingested_at=row["ingested_at"],
            status=row["status"],
            year=row["year"],
            module=row["module"],
            document_type=row["document_type"],
            chunk_count=row["chunk_count"],
            error_message=row["error_message"],
        )

    @staticmethod
    def _row_to_chunk(row: sqlite3.Row) -> ChunkRecord:
        return ChunkRecord(
            id=row["id"],
            document_id=row["document_id"],
            chunk_index=row["chunk_index"],
            text=row["text"],
            filename=row["filename"],
            filepath=row["filepath"],
            page_start=row["page_start"],
            page_end=row["page_end"],
            heading=row["heading"],
            year=row["year"],
            module=row["module"],
            document_type=row["document_type"],
        )
