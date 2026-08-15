#!/usr/bin/env python3
"""Run incremental document ingestion from the command line.

If the FastAPI server is already running, posts to POST /api/ingest
(required because local Qdrant allows only one process).

If the server is not running, ingests in-process.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

import httpx

from app.config import get_settings  # noqa: E402
from app.logging_config import setup_logging  # noqa: E402


def _backend_base(settings) -> str:
    return f"http://{settings.host}:{settings.port}"


def _backend_reachable(settings) -> bool:
    try:
        with httpx.Client(timeout=3.0) as client:
            r = client.get(f"{_backend_base(settings)}/api/health")
            return r.status_code == 200
    except Exception:
        return False


def _api_ingest(settings) -> int:
    base = _backend_base(settings)
    url = f"{base}/api/ingest"
    status_url = f"{base}/api/ingest/status"
    print(f"Backend is running — starting background ingest via {url}")
    print("(OCR/embed can take a while. Chat should stay usable. Leave this window open.)\n")
    sys.stdout.flush()

    timeout = httpx.Timeout(30.0, connect=10.0)
    try:
        with httpx.Client(timeout=timeout) as client:
            r = client.post(url)
            if r.status_code >= 400:
                print(f"ERROR: ingest API returned {r.status_code}")
                print(r.text[:2000])
                return 1

            import time

            while True:
                s = client.get(status_url)
                if s.status_code >= 400:
                    print(f"ERROR: status API returned {s.status_code}")
                    print(s.text[:2000])
                    return 1
                job = s.json()
                status = job.get("status")
                if status == "running":
                    print("… still running")
                    sys.stdout.flush()
                    time.sleep(2.0)
                    continue
                if status == "error":
                    print(f"ERROR: {job.get('error')}")
                    return 1
                data = job.get("result") or {}
                break
    except httpx.HTTPError as exc:
        print(f"ERROR: ingest API request failed: {exc}")
        print("Is uvicorn still running? Start it, then re-run this script.")
        return 1

    print(
        f"Found {data.get('files_found')}.\n"
        f"Processed (new): {data.get('processed')}\n"
        f"Updated: {data.get('updated')}\n"
        f"Skipped: {data.get('skipped')}\n"
        f"Deleted from index: {data.get('deleted')}\n"
        f"Errors: {data.get('errors')}\n"
        f"Chunks created: {data.get('chunks_created')}\n"
    )
    details = data.get("details") or []
    for line in details[:80]:
        print(line)
    if len(details) > 80:
        print(f"... ({len(details) - 80} more lines)")
    return 0


def _direct_ingest(settings) -> int:
    from app.database.qdrant import QdrantStore
    from app.database.sqlite import SQLiteDatabase
    from app.llm.ollama_client import OllamaClient, OllamaError
    from app.retrieval.embeddings import EmbeddingService
    from app.services.ingestion_service import IngestionService

    print("Backend not running — direct ingestion (opens local Qdrant in this process).\n")
    sys.stdout.flush()

    ollama = OllamaClient(
        settings.ollama_base_url,
        settings.ollama_chat_model,
        settings.ollama_embed_model,
    )
    health = ollama.health()
    if not health.get("reachable"):
        print(f"ERROR: {health.get('error')}")
        return 1
    if not health.get("embed_model_available"):
        print("ERROR: Embedding model not available. Pull it with:")
        print(f"  ollama pull {settings.ollama_embed_model}")
        return 1

    try:
        db = SQLiteDatabase(settings.resolve_sqlite_path())
        qdrant = QdrantStore(settings.resolve_qdrant_path(), settings.qdrant_collection)
    except RuntimeError as exc:
        print(f"ERROR: {exc}")
        print("Another process is using data/qdrant. Stop uvicorn/ingest, then retry.")
        return 1

    embeddings = EmbeddingService(ollama)
    service = IngestionService(settings, db, qdrant, embeddings)
    try:
        service.run()
    except OllamaError as exc:
        print(f"ERROR: {exc}")
        return 1
    return 0


def main() -> int:
    setup_logging()
    settings = get_settings()

    if _backend_reachable(settings):
        # Do NOT fall back to direct mode — Qdrant would be locked by uvicorn.
        return _api_ingest(settings)

    return _direct_ingest(settings)


if __name__ == "__main__":
    raise SystemExit(main())
