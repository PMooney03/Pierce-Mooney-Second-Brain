"""Hybrid retrieval: semantic + keyword with RRF fusion."""

from __future__ import annotations

import re

from app.database.models import ChunkRecord, SearchHit
from app.retrieval.keyword_search import KeywordSearch
from app.retrieval.reranker import reciprocal_rank_fusion, lexical_boost
from app.retrieval.vector_search import VectorSearch


class HybridSearch:
    def __init__(self, vector: VectorSearch, keyword: KeywordSearch) -> None:
        self.vector = vector
        self.keyword = keyword

    def search(
        self,
        query: str,
        *,
        top_k: int = 8,
        semantic_limit: int | None = None,
        keyword_limit: int | None = None,
        prefer_keyword: bool = False,
    ) -> list[SearchHit]:
        sem_n = semantic_limit or max(top_k * 2, 10)
        key_n = keyword_limit or max(top_k * 2, 10)

        if prefer_keyword:
            key_n = max(key_n, top_k * 3)

        semantic = self.vector.search(query, limit=sem_n)
        keyword = self.keyword.search(query, limit=key_n)

        fused = reciprocal_rank_fusion(
            [semantic, keyword],
            labels=["semantic", "keyword"],
            k=60,
        )

        # Lexical boost for exact term presence
        terms = [t for t in re.findall(r"[A-Za-z0-9_./+-]+", query) if len(t) > 1]
        boosted = lexical_boost(fused, terms)

        hits: list[SearchHit] = []
        for chunk_id, score, meta in boosted[:top_k]:
            chunk: ChunkRecord = meta["chunk"]
            chunk.score = score
            chunk.score_source = "hybrid"
            hits.append(
                SearchHit(
                    chunk=chunk,
                    semantic_score=meta.get("semantic_score"),
                    keyword_score=meta.get("keyword_score"),
                    hybrid_score=score,
                )
            )
        return hits
