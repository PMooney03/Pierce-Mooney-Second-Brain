"""Semantic vector search via Qdrant."""

from __future__ import annotations

from app.database.qdrant import QdrantStore
from app.database.sqlite import SQLiteDatabase
from app.database.models import ChunkRecord
from app.retrieval.embeddings import EmbeddingService


class VectorSearch:
    def __init__(
        self,
        qdrant: QdrantStore,
        db: SQLiteDatabase,
        embeddings: EmbeddingService,
    ) -> None:
        self.qdrant = qdrant
        self.db = db
        self.embeddings = embeddings

    def search(self, query: str, limit: int = 10) -> list[tuple[ChunkRecord, float]]:
        if not query.strip():
            return []
        if not self.qdrant.collection_exists():
            return []

        vector = self.embeddings.embed_query(query)
        hits = self.qdrant.search(vector, limit=limit)
        chunk_ids = [h["chunk_id"] for h in hits]
        chunks = self.db.get_chunks_by_ids(chunk_ids)
        by_id = {c.id: c for c in chunks}
        results: list[tuple[ChunkRecord, float]] = []
        for h in hits:
            chunk = by_id.get(h["chunk_id"])
            if chunk:
                chunk.score = h["score"]
                chunk.score_source = "semantic"
                results.append((chunk, float(h["score"])))
        return results
