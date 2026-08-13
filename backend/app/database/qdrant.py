"""Local Qdrant vector store (path-based, no cloud)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from app.logging_config import get_logger

logger = get_logger(__name__)


class QdrantStore:
    """Persistent local Qdrant collection for chunk embeddings."""

    def __init__(self, path: Path, collection_name: str) -> None:
        self.path = Path(path)
        self.path.mkdir(parents=True, exist_ok=True)
        self.collection_name = collection_name
        self.client = QdrantClient(path=str(self.path))
        self._vector_size: int | None = None
        logger.info("Qdrant local store at %s", self.path)

    def ensure_collection(self, vector_size: int) -> None:
        """Create collection if missing; recreate if vector size mismatches."""
        self._vector_size = vector_size
        existing = {c.name for c in self.client.get_collections().collections}
        if self.collection_name in existing:
            info = self.client.get_collection(self.collection_name)
            current = info.config.params.vectors.size  # type: ignore[union-attr]
            if current == vector_size:
                return
            logger.warning(
                "Recreating Qdrant collection %s (size %s → %s)",
                self.collection_name,
                current,
                vector_size,
            )
            self.client.delete_collection(self.collection_name)

        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=qm.VectorParams(size=vector_size, distance=qm.Distance.COSINE),
        )
        logger.info(
            "Created Qdrant collection %s (dim=%s)", self.collection_name, vector_size
        )

    def upsert_vectors(
        self,
        ids: list[str],
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
    ) -> None:
        if not ids:
            return
        if self._vector_size is None and vectors:
            self.ensure_collection(len(vectors[0]))

        points = [
            qm.PointStruct(id=self._stable_uuid(cid), vector=vec, payload={**payload, "chunk_id": cid})
            for cid, vec, payload in zip(ids, vectors, payloads)
        ]
        self.client.upsert(collection_name=self.collection_name, points=points)

    def delete_by_chunk_ids(self, chunk_ids: list[str]) -> None:
        if not chunk_ids:
            return
        point_ids = [self._stable_uuid(cid) for cid in chunk_ids]
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=qm.PointIdsList(points=point_ids),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Qdrant delete failed: %s", exc)

    def search(
        self,
        query_vector: list[float],
        limit: int = 10,
        score_threshold: float | None = None,
    ) -> list[dict[str, Any]]:
        """Return list of {chunk_id, score, payload}."""
        try:
            response = self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                limit=limit,
                score_threshold=score_threshold,
                with_payload=True,
            )
            results = response.points
        except Exception as exc:  # noqa: BLE001
            logger.error("Qdrant search failed: %s", exc)
            return []

        hits: list[dict[str, Any]] = []
        for r in results:
            payload = r.payload or {}
            chunk_id = payload.get("chunk_id")
            if not chunk_id:
                continue
            hits.append({"chunk_id": chunk_id, "score": float(r.score), "payload": payload})
        return hits

    def collection_exists(self) -> bool:
        names = {c.name for c in self.client.get_collections().collections}
        return self.collection_name in names

    def reset(self) -> None:
        if self.collection_exists():
            self.client.delete_collection(self.collection_name)
            logger.info("Deleted Qdrant collection %s", self.collection_name)
        self._vector_size = None

    @staticmethod
    def _stable_uuid(chunk_id: str) -> str:
        """Derive a UUID string from chunk_id for Qdrant point IDs."""
        import uuid

        return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))
