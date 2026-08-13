"""Shared application dependencies / singletons."""

from __future__ import annotations

from functools import lru_cache

from app.config import Settings, get_settings
from app.database.qdrant import QdrantStore
from app.database.sqlite import SQLiteDatabase
from app.llm.ollama_client import OllamaClient


@lru_cache
def get_db() -> SQLiteDatabase:
    settings = get_settings()
    return SQLiteDatabase(settings.resolve_sqlite_path())


@lru_cache
def get_qdrant() -> QdrantStore:
    settings = get_settings()
    return QdrantStore(settings.resolve_qdrant_path(), settings.qdrant_collection)


@lru_cache
def get_ollama() -> OllamaClient:
    settings = get_settings()
    return OllamaClient(
        base_url=settings.ollama_base_url,
        chat_model=settings.ollama_chat_model,
        embed_model=settings.ollama_embed_model,
    )


def get_app_settings() -> Settings:
    return get_settings()
