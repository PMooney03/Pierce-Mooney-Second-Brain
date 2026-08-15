"""Document ingestion orchestration with incremental hashing."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database.models import DocumentStatus
from app.database.qdrant import QdrantStore
from app.database.sqlite import SQLiteDatabase
from app.ingestion.base_parser import ParserRegistry
from app.ingestion.chunker import DocumentChunker
from app.ingestion.code_parser import CodeParseError, CodeParser
from app.ingestion.docx_parser import DocxParseError, DocxParser
from app.ingestion.image_parser import ImageParseError, ImageParser
from app.ingestion.metadata import extract_path_metadata
from app.ingestion.pdf_parser import PdfParseError, PdfParser
from app.ingestion.scanner import ScannedFile, scan_documents
from app.logging_config import get_logger
from app.retrieval.embeddings import EmbeddingService

logger = get_logger(__name__)


@dataclass
class IngestionStats:
    files_found: int = 0
    processed: int = 0  # new
    skipped: int = 0
    updated: int = 0
    deleted: int = 0
    errors: int = 0
    chunks_created: int = 0
    details: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "files_found": self.files_found,
            "processed": self.processed,
            "skipped": self.skipped,
            "updated": self.updated,
            "deleted": self.deleted,
            "errors": self.errors,
            "chunks_created": self.chunks_created,
            "details": self.details,
        }


class IngestionService:
    def __init__(
        self,
        settings: Settings,
        db: SQLiteDatabase,
        qdrant: QdrantStore,
        embeddings: EmbeddingService,
    ) -> None:
        self.settings = settings
        self.db = db
        self.qdrant = qdrant
        self.embeddings = embeddings
        self.chunker = DocumentChunker(settings.chunk_size, settings.chunk_overlap)
        self.registry = ParserRegistry()
        self.registry.register(PdfParser())
        self.registry.register(DocxParser())
        self.registry.register(CodeParser())
        if settings.ocr_enabled:
            self.registry.register(ImageParser())

    def run(self, *, remove_missing: bool = True) -> IngestionStats:
        root = self.settings.resolve_documents_path()
        stats = IngestionStats()
        run_id = self.db.start_ingestion_run()

        print(f"\nScanning: {root}\n")
        files = scan_documents(root, extensions=self.registry.supported())
        stats.files_found = len(files)
        print(f"Found {stats.files_found} files.\n")

        seen_paths: set[str] = set()

        for scanned in files:
            seen_paths.add(scanned.relative_path)
            try:
                action = self._process_file(scanned, stats)
                label = {
                    "skip": "SKIP",
                    "new": "NEW",
                    "updated": "UPDATED",
                }.get(action, action.upper())
                line = f"[{label}] {scanned.relative_path}"
                print(line)
                stats.details.append(line)
            except Exception as exc:  # noqa: BLE001
                stats.errors += 1
                msg = f"[ERROR] {scanned.relative_path}: {exc}"
                print(msg)
                logger.error("Ingestion failed for %s: %s", scanned.relative_path, exc)
                stats.details.append(msg)
                self.db.mark_document_error(None, scanned.relative_path, str(exc))

        if remove_missing:
            self._handle_deleted(seen_paths, stats)

        self.db.finish_ingestion_run(run_id, stats.as_dict())

        print(
            f"\nProcessed (new): {stats.processed}\n"
            f"Updated: {stats.updated}\n"
            f"Skipped: {stats.skipped}\n"
            f"Deleted from index: {stats.deleted}\n"
            f"Errors: {stats.errors}\n"
            f"Chunks created: {stats.chunks_created}\n"
        )
        return stats

    def _process_file(self, scanned: ScannedFile, stats: IngestionStats) -> str:
        existing = self.db.get_document_by_path(scanned.relative_path)
        if existing and existing.file_hash == scanned.file_hash and existing.status == DocumentStatus.ACTIVE.value:
            stats.skipped += 1
            return "skip"

        is_update = existing is not None
        meta = extract_path_metadata(scanned.relative_path)
        parser = self.registry.get(scanned.extension)
        if parser is None:
            raise RuntimeError(f"No parser for {scanned.extension}")

        try:
            extracted = parser.parse(scanned.path, scanned.relative_path)
        except (PdfParseError, DocxParseError, CodeParseError, ImageParseError):
            raise
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(str(exc)) from exc

        chunks = self.chunker.chunk(extracted)
        if not chunks:
            raise RuntimeError("No chunks produced")

        # Remove old index entries on update
        if existing:
            old_ids = self.db.delete_chunks_for_document(existing.id)
            self.qdrant.delete_by_chunk_ids(old_ids)

        doc_id = self.db.upsert_document(
            filepath=scanned.relative_path,
            filename=scanned.filename,
            file_hash=scanned.file_hash,
            file_size=scanned.size,
            file_type=scanned.extension.lstrip("."),
            modified_at=scanned.modified_at,
            year=meta.get("year"),
            module=meta.get("module"),
            document_type=meta.get("document_type"),
            status=DocumentStatus.ACTIVE.value,
            chunk_count=0,
        )

        chunk_rows: list[dict[str, Any]] = []
        texts: list[str] = []
        for ch in chunks:
            chunk_id = str(uuid.uuid4())
            chunk_rows.append(
                {
                    "id": chunk_id,
                    "document_id": doc_id,
                    "chunk_index": ch.chunk_index,
                    "text": ch.text,
                    "filename": scanned.filename,
                    "filepath": scanned.relative_path,
                    "page_start": ch.page_start,
                    "page_end": ch.page_end,
                    "heading": ch.heading,
                    "year": meta.get("year"),
                    "module": meta.get("module"),
                    "document_type": meta.get("document_type"),
                    "metadata": ch.metadata,
                }
            )
            texts.append(ch.text)

        # Embeddings
        vectors = self.embeddings.embed_texts(texts)
        if vectors and self.embeddings.vector_size:
            self.qdrant.ensure_collection(self.embeddings.vector_size)

        payloads = [
            {
                "document_id": doc_id,
                "filename": scanned.filename,
                "filepath": scanned.relative_path,
                "page_start": row.get("page_start"),
                "heading": row.get("heading"),
                "year": row.get("year"),
                "module": row.get("module"),
            }
            for row in chunk_rows
        ]
        self.qdrant.upsert_vectors(
            ids=[r["id"] for r in chunk_rows],
            vectors=vectors,
            payloads=payloads,
        )
        created = self.db.insert_chunks(chunk_rows)
        self.db.upsert_document(
            filepath=scanned.relative_path,
            filename=scanned.filename,
            file_hash=scanned.file_hash,
            file_size=scanned.size,
            file_type=scanned.extension.lstrip("."),
            modified_at=scanned.modified_at,
            year=meta.get("year"),
            module=meta.get("module"),
            document_type=meta.get("document_type"),
            status=DocumentStatus.ACTIVE.value,
            chunk_count=created,
        )

        if meta.get("module"):
            self.db.upsert_module(str(meta["module"]), meta.get("year"))  # type: ignore[arg-type]

        stats.chunks_created += created
        if is_update:
            stats.updated += 1
            return "updated"
        stats.processed += 1
        return "new"

    def _handle_deleted(self, seen_paths: set[str], stats: IngestionStats) -> None:
        for filepath in self.db.all_active_filepaths():
            if filepath in seen_paths:
                continue
            doc = self.db.get_document_by_path(filepath)
            if not doc:
                continue
            old_ids = self.db.delete_chunks_for_document(doc.id)
            self.qdrant.delete_by_chunk_ids(old_ids)
            self.db.mark_document_unavailable(doc.id)
            stats.deleted += 1
            line = f"[DELETED] {filepath} (removed from index)"
            print(line)
            stats.details.append(line)
