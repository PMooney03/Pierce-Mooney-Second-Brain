"""Embedding helpers using Ollama."""

from __future__ import annotations

from app.llm.ollama_client import OllamaClient
from app.logging_config import get_logger

logger = get_logger(__name__)


class EmbeddingService:
    """Create embeddings via Ollama; remember vector size."""

    def __init__(self, ollama: OllamaClient) -> None:
        self.ollama = ollama
        self._vector_size: int | None = None

    @property
    def vector_size(self) -> int | None:
        return self._vector_size

    def embed_query(self, text: str) -> list[float]:
        vector = self.ollama.embed(text)
        self._vector_size = len(vector)
        return vector

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for i, text in enumerate(texts):
            vec = self.ollama.embed(text)
            if self._vector_size is None:
                self._vector_size = len(vec)
            vectors.append(vec)
            if (i + 1) % 25 == 0:
                logger.info("Embedded %s/%s chunks", i + 1, len(texts))
        return vectors
