"""FastAPI entrypoint for CharlesGPT."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, documents, health, knowledge, search, sessions
from app.deps import get_db, get_ollama, get_qdrant
from app.logging_config import get_logger, setup_logging

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Eager-init local stores
    get_db()
    get_qdrant()
    ollama = get_ollama()
    status = ollama.health()
    if not status.get("reachable"):
        logger.error("Ollama is not reachable: %s", status.get("error"))
    elif not status.get("ok"):
        logger.warning("Ollama reachable but models missing: %s", status.get("error"))
    else:
        logger.info(
            "Ollama ready (chat=%s, embed=%s)",
            status.get("chat_model"),
            status.get("embed_model"),
        )
    yield


app = FastAPI(
    title="CharlesGPT",
    description="Local private knowledge system for college materials.",
    version="0.1.0",
    lifespan=lifespan,
)

# Local frontend only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(sessions.router)
app.include_router(knowledge.router)


@app.get("/")
def root() -> dict:
    return {
        "name": "CharlesGPT",
        "docs": "/docs",
        "health": "/api/health",
    }
