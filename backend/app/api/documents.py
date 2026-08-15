"""Document and ingestion API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import get_settings
from app.deps import get_db, get_ollama, get_qdrant
from app.retrieval.embeddings import EmbeddingService
from app.services.ingest_jobs import get_ingest_status, start_ingest_job, update_ingest_progress
from app.services.ingestion_service import IngestionService

router = APIRouter(tags=["documents"])


class IngestResponse(BaseModel):
    files_found: int
    processed: int
    skipped: int
    updated: int
    deleted: int
    errors: int
    chunks_created: int
    details: list[str] = Field(default_factory=list)


class DocumentOut(BaseModel):
    id: int
    filepath: str
    filename: str
    file_type: str
    file_size: int
    status: str
    year: str | None = None
    module: str | None = None
    document_type: str | None = None
    chunk_count: int = 0
    ingested_at: str | None = None
    modified_at: str | None = None
    error_message: str | None = None


class ChunkOut(BaseModel):
    id: str
    document_id: int
    chunk_index: int
    text: str
    filename: str
    filepath: str
    page_start: int | None = None
    page_end: int | None = None
    heading: str | None = None
    year: str | None = None
    module: str | None = None
    document_type: str | None = None


def _run_ingest() -> dict[str, Any]:
    settings = get_settings()
    db = get_db()
    qdrant = get_qdrant()
    embeddings = EmbeddingService(get_ollama())
    service = IngestionService(settings, db, qdrant, embeddings)
    return service.run(on_progress=update_ingest_progress).as_dict()


@router.get("/api/ingest")
def ingest_info() -> dict[str, Any]:
    """Browsers only GET — how to run ingest + current job status."""
    return {
        "detail": "POST /api/ingest starts a background job. Poll GET /api/ingest/status. "
        "Or use Library → Run ingest, or: python scripts/ingest.py",
        "docs": "/docs",
        "ui": "http://127.0.0.1:5173",
        "job": get_ingest_status(),
    }


@router.get("/api/ingest/status")
def ingest_status() -> dict[str, Any]:
    return get_ingest_status()


@router.post("/api/ingest")
def ingest_documents() -> dict[str, Any]:
    """Start incremental ingest in a background thread (keeps chat responsive)."""
    job = start_ingest_job(_run_ingest)
    return {
        "status": job["status"],
        "started_at": job["started_at"],
        "message": "Ingest running in the background. Poll GET /api/ingest/status.",
        "job": job,
    }


@router.get("/api/documents", response_model=list[DocumentOut])
def list_documents(
    year: str | None = None,
    module: str | None = None,
    document_type: str | None = None,
    q: str | None = Query(default=None, description="Filename filter"),
    status: str | None = "active",
) -> list[DocumentOut]:
    docs = get_db().list_documents(
        year=year,
        module=module,
        document_type=document_type,
        filename_query=q,
        status=status,
    )
    return [
        DocumentOut(
            id=d.id,
            filepath=d.filepath,
            filename=d.filename,
            file_type=d.file_type,
            file_size=d.file_size,
            status=d.status,
            year=d.year,
            module=d.module,
            document_type=d.document_type,
            chunk_count=d.chunk_count,
            ingested_at=d.ingested_at,
            modified_at=d.modified_at,
            error_message=d.error_message,
        )
        for d in docs
    ]


@router.get("/api/documents/{document_id}", response_model=dict[str, Any])
def get_document(document_id: int) -> dict[str, Any]:
    db = get_db()
    doc = db.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    with db.connection() as conn:
        rows = conn.execute(
            "SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index",
            (document_id,),
        ).fetchall()
    chunks = [
        ChunkOut(
            id=r["id"],
            document_id=r["document_id"],
            chunk_index=r["chunk_index"],
            text=r["text"],
            filename=r["filename"],
            filepath=r["filepath"],
            page_start=r["page_start"],
            page_end=r["page_end"],
            heading=r["heading"],
            year=r["year"],
            module=r["module"],
            document_type=r["document_type"],
        ).model_dump()
        for r in rows
    ]
    return {
        "document": DocumentOut(
            id=doc.id,
            filepath=doc.filepath,
            filename=doc.filename,
            file_type=doc.file_type,
            file_size=doc.file_size,
            status=doc.status,
            year=doc.year,
            module=doc.module,
            document_type=doc.document_type,
            chunk_count=doc.chunk_count,
            ingested_at=doc.ingested_at,
            modified_at=doc.modified_at,
            error_message=doc.error_message,
        ).model_dump(),
        "chunks": chunks,
    }


@router.get("/api/chunks/{chunk_id}", response_model=ChunkOut)
def get_chunk(chunk_id: str) -> ChunkOut:
    chunk = get_db().get_chunk(chunk_id)
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return ChunkOut(
        id=chunk.id,
        document_id=chunk.document_id,
        chunk_index=chunk.chunk_index,
        text=chunk.text,
        filename=chunk.filename,
        filepath=chunk.filepath,
        page_start=chunk.page_start,
        page_end=chunk.page_end,
        heading=chunk.heading,
        year=chunk.year,
        module=chunk.module,
        document_type=chunk.document_type,
    )
