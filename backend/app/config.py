"""Application configuration loaded from environment / .env."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root = CollegeAI/ (parent of backend/)
PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime settings for the Academic Second Brain."""

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "llama3.2:latest"
    ollama_embed_model: str = "nomic-embed-text"

    documents_path: str = ""
    sqlite_path: str = "data/sqlite/second_brain.db"
    qdrant_path: str = "data/qdrant"

    chunk_size: int = Field(default=800, ge=100, le=4000)
    chunk_overlap: int = Field(default=100, ge=0, le=1000)
    top_k: int = Field(default=8, ge=1, le=50)

    # Free DuckDuckGo Instant Answer enrichment (no API key)
    web_lookup_enabled: bool = True
    web_lookup_timeout: float = Field(default=8.0, ge=2.0, le=30.0)
    default_weather_location: str = "Dublin"

    host: str = "127.0.0.1"
    port: int = 8000

    qdrant_collection: str = "college_chunks"

    def resolve_documents_path(self) -> Path:
        """Return the corpus root. Defaults to project root (Year1–Year4)."""
        if self.documents_path.strip():
            p = Path(self.documents_path)
            return p if p.is_absolute() else (PROJECT_ROOT / p).resolve()
        return PROJECT_ROOT.resolve()

    def resolve_sqlite_path(self) -> Path:
        p = Path(self.sqlite_path)
        path = p if p.is_absolute() else (PROJECT_ROOT / p).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def resolve_qdrant_path(self) -> Path:
        p = Path(self.qdrant_path)
        path = p if p.is_absolute() else (PROJECT_ROOT / p).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    return Settings()
