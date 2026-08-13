"""Retrieval-trace event builders for the live hive visualisation.

Events describe real search/system activity only — never LLM chain-of-thought.
"""

from __future__ import annotations

import re
from typing import Any, Iterator

from app.database.models import ChatMode, SearchHit, SourceCitation
from app.database.sqlite import SQLiteDatabase

STOPWORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "what",
    "which",
    "who",
    "how",
    "why",
    "when",
    "where",
    "did",
    "do",
    "does",
    "my",
    "me",
    "i",
    "we",
    "you",
    "about",
    "with",
    "from",
    "into",
    "that",
    "this",
    "these",
    "those",
    "as",
    "at",
    "by",
    "it",
    "tell",
    "me",
    "every",
    "everywhere",
    "have",
    "has",
    "used",
    "use",
    "using",
    "find",
    "explain",
    "summarise",
    "summarize",
    "college",
    "year",
    "first",
    "second",
    "third",
    "fourth",
    "final",
}

MAX_MATCH_EVENTS = 16


def topic_label(query: str) -> str | None:
    """Heuristic topic chip from the query — no LLM."""
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9_./+-]*", query or "")
    keep = [t for t in tokens if t.lower() not in STOPWORDS and len(t) > 1]
    if not keep:
        return None
    # Prefer longer technical tokens
    keep.sort(key=lambda t: (-len(t), t.lower()))
    label = keep[0]
    if len(label) > 28:
        label = label[:25] + "…"
    return label


def match_type_for_hit(hit: SearchHit) -> str:
    sem = hit.semantic_score
    key = hit.keyword_score
    if sem is not None and key is not None:
        if key >= sem * 1.15:
            return "keyword"
        if sem >= key * 1.15:
            return "semantic"
        return "hybrid"
    if key is not None and sem is None:
        return "keyword"
    if sem is not None and key is None:
        return "semantic"
    return "hybrid"


def scope_label_for_chunk(*, year: str | None, filepath: str | None, module: str | None) -> str:
    path = (filepath or "").lower()
    if "project" in path or (module or "").lower() == "projects":
        return "Projects"
    if year and year.strip():
        y = year.strip()
        if re.match(r"^year\s*\d$", y, re.I):
            return re.sub(r"(?i)year\s*", "Year ", y)
        if re.match(r"^\d$", y):
            return f"Year {y}"
        return y
    return "Other Material"


def emit_trace_started(query: str, mode: ChatMode) -> dict[str, Any]:
    return {
        "event": "trace_started",
        "query": query,
        "mode": mode.value,
        "topic": topic_label(query),
    }


def emit_phase(phase: str, message: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"event": "phase", "phase": phase}
    if message:
        payload["message"] = message
    return payload


def emit_scope(
    name: str,
    *,
    document_count: int | None = None,
    state: str = "searching",
) -> dict[str, Any]:
    return {
        "event": "scope",
        "scope": name,
        "document_count": document_count,
        "state": state,
    }


def emit_module(
    name: str,
    *,
    year: str | None = None,
    document_count: int | None = None,
    state: str = "searching",
) -> dict[str, Any]:
    return {
        "event": "module",
        "module": name,
        "year": year,
        "document_count": document_count,
        "state": state,
    }


def emit_stats(
    *,
    documents: int | None = None,
    years: int | None = None,
    modules: int | None = None,
    candidates: int | None = None,
    strong_matches: int | None = None,
    message: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"event": "stats"}
    if documents is not None:
        payload["documents"] = documents
    if years is not None:
        payload["years"] = years
    if modules is not None:
        payload["modules"] = modules
    if candidates is not None:
        payload["candidates"] = candidates
    if strong_matches is not None:
        payload["strong_matches"] = strong_matches
    if message:
        payload["message"] = message
    return payload


def emit_match_from_hit(hit: SearchHit, *, preview_chars: int = 280) -> dict[str, Any]:
    chunk = hit.chunk
    preview = (chunk.text or "").strip()
    if len(preview) > preview_chars:
        preview = preview[: preview_chars - 1] + "…"
    mtype = match_type_for_hit(hit)
    score = hit.hybrid_score or chunk.score
    return {
        "event": "match",
        "source": {
            "document_id": chunk.document_id,
            "chunk_id": chunk.id,
            "filename": chunk.filename,
            "filepath": chunk.filepath,
            "page": chunk.page_start,
            "heading": chunk.heading,
            "text_preview": preview,
            "year": chunk.year,
            "module": chunk.module,
            "score": score,
            "match_type": mtype,
            "semantic_score": hit.semantic_score,
            "keyword_score": hit.keyword_score,
        },
        "scope": scope_label_for_chunk(
            year=chunk.year, filepath=chunk.filepath, module=chunk.module
        ),
        "match_type": mtype,
        "score": score,
    }


def emit_match_from_citation(cite: SourceCitation) -> dict[str, Any]:
    score = getattr(cite, "score", None)
    mtype = getattr(cite, "match_type", None) or "hybrid"
    return {
        "event": "match",
        "source": {
            "document_id": cite.document_id,
            "chunk_id": cite.chunk_id,
            "filename": cite.filename,
            "filepath": cite.filepath,
            "page": cite.page,
            "heading": cite.heading,
            "text_preview": cite.text_preview,
            "year": cite.year,
            "module": cite.module,
            "score": score,
            "match_type": mtype,
        },
        "scope": scope_label_for_chunk(
            year=cite.year, filepath=cite.filepath, module=cite.module
        ),
        "match_type": mtype,
        "score": score,
    }


def emit_sources_selected(chunk_ids: list[str]) -> dict[str, Any]:
    return {"event": "sources_selected", "chunk_ids": chunk_ids}


def emit_trace_complete() -> dict[str, Any]:
    return {"event": "trace_complete"}


def select_scopes(
    db: SQLiteDatabase | None,
    *,
    year_focus: str | None,
    project_focus: bool = False,
) -> list[dict[str, Any]]:
    """Real inventory scopes for the search space (not fake file scans)."""
    if db is None:
        if year_focus:
            return [{"name": year_focus, "document_count": None}]
        return [
            {"name": f"Year {n}", "document_count": None} for n in range(1, 5)
        ] + [{"name": "Projects", "document_count": None}]

    if year_focus:
        docs = db.list_documents(year=year_focus, status="active")
        scopes = [{"name": year_focus, "document_count": len(docs)}]
        if project_focus:
            projects = db.list_projects()
            scopes.append({"name": "Projects", "document_count": len(projects)})
        return scopes

    years = db.list_years()
    scopes = [
        {"name": y.get("name") or "Other Material", "document_count": y.get("document_count")}
        for y in years
        if y.get("name")
    ]
    projects = db.list_projects()
    if projects:
        scopes.append({"name": "Projects", "document_count": len(projects)})
    if not scopes:
        scopes = [{"name": "Other Material", "document_count": 0}]
    return scopes


def select_modules_for_year(
    db: SQLiteDatabase | None,
    year: str,
) -> list[dict[str, Any]]:
    if db is None:
        return []
    return [
        {
            "name": m.get("name"),
            "year": year,
            "document_count": m.get("document_count"),
        }
        for m in db.list_modules(year=year)
        if m.get("name")
    ]


def iter_pre_search_trace(
    db: SQLiteDatabase | None,
    *,
    query: str,
    mode: ChatMode,
    year_focus: str | None,
    project_focus: bool = False,
    expand_modules: bool = False,
) -> Iterator[dict[str, Any]]:
    """Emit cheap inventory events before hybrid search runs."""
    yield emit_trace_started(query, mode)
    yield {
        "event": "status",
        "message": "Searching academic memory…",
        "node": "archive",
    }
    scopes = select_scopes(db, year_focus=year_focus, project_focus=project_focus)
    total_docs = sum(int(s.get("document_count") or 0) for s in scopes)
    yield emit_stats(
        documents=total_docs or None,
        years=len([s for s in scopes if str(s["name"]).startswith("Year")]),
        modules=None,
        message=f"Scanning {len(scopes)} academic area{'s' if len(scopes) != 1 else ''}…",
    )
    for s in scopes:
        yield emit_scope(
            str(s["name"]),
            document_count=s.get("document_count"),
            state="searching",
        )
        yield {
            "event": "status",
            "message": f"Checking {s['name']}…",
            "node": "archive",
        }

    modules: list[dict[str, Any]] = []
    if expand_modules and year_focus:
        modules = select_modules_for_year(db, year_focus)
        yield emit_stats(
            documents=total_docs or None,
            years=1,
            modules=len(modules),
            message=f"Mapping {year_focus}: {len(modules)} modules…",
        )
        for m in modules:
            yield emit_module(
                str(m["name"]),
                year=year_focus,
                document_count=m.get("document_count"),
                state="searching",
            )

    yield emit_phase("keyword", "Keyword search…")
    yield emit_phase("semantic", "Semantic search…")
    yield emit_phase("fuse", "Fusing rankings…")


def iter_hit_trace(
    hits: list[SearchHit],
    *,
    limit: int = MAX_MATCH_EVENTS,
) -> Iterator[dict[str, Any]]:
    """Emit match events from real hybrid hits."""
    capped = hits[:limit]
    strong = sum(1 for h in capped if (h.hybrid_score or 0) >= 0.02 or (h.chunk.score or 0) >= 0.02)
    # Always treat returned hits as candidates; strong = top half by score
    scores = sorted((h.hybrid_score or 0) for h in capped)
    median = scores[len(scores) // 2] if scores else 0
    strong = sum(1 for h in capped if (h.hybrid_score or 0) >= median)

    # Module nodes from hits
    seen_mods: set[tuple[str | None, str]] = set()
    for h in capped:
        mod = h.chunk.module
        if not mod:
            continue
        key = (h.chunk.year, mod)
        if key in seen_mods:
            continue
        seen_mods.add(key)
        yield emit_module(
            mod,
            year=h.chunk.year,
            state="matched",
        )

    yield emit_stats(
        candidates=len(capped),
        strong_matches=max(strong, 1) if capped else 0,
        modules=len(seen_mods) or None,
        message=f"{len(capped)} relevant section{'s' if len(capped) != 1 else ''} retrieved…",
    )

    for h in capped:
        match_ev = emit_match_from_hit(h)
        yield match_ev
        yield {
            "event": "file",
            "source": match_ev["source"],
            "node": "archive",
        }
