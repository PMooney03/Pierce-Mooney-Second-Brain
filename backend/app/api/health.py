"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import PROJECT_ROOT, get_settings
from app.deps import get_db, get_ollama, get_qdrant

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health() -> dict:
    settings = get_settings()
    ollama = get_ollama()
    ollama_health = ollama.health()

    db_ok = False
    db_error = None
    try:
        with get_db().connection() as conn:
            conn.execute("SELECT 1").fetchone()
        db_ok = True
    except Exception as exc:  # noqa: BLE001
        db_error = str(exc)

    qdrant_ok = False
    qdrant_error = None
    try:
        store = get_qdrant()
        qdrant_ok = True
        _ = store.collection_exists()
    except Exception as exc:  # noqa: BLE001
        qdrant_error = str(exc)

    overall = bool(ollama_health.get("reachable")) and db_ok and qdrant_ok

    return {
        "status": "ok" if overall else "degraded",
        "project_root": str(PROJECT_ROOT),
        "documents_path": str(settings.resolve_documents_path()),
        "sqlite_path": str(settings.resolve_sqlite_path()),
        "qdrant_path": str(settings.resolve_qdrant_path()),
        "ollama": ollama_health,
        "sqlite": {"ok": db_ok, "error": db_error},
        "qdrant": {"ok": qdrant_ok, "error": qdrant_error},
        "config": {
            "chat_model": settings.ollama_chat_model,
            "embed_model": settings.ollama_embed_model,
            "chunk_size": settings.chunk_size,
            "chunk_overlap": settings.chunk_overlap,
            "top_k": settings.top_k,
        },
    }
