"""Search service wrapping hybrid retrieval."""

from __future__ import annotations

from app.config import Settings
from app.database.models import SearchHit
from app.database.sqlite import SQLiteDatabase
from app.retrieval.hybrid_search import HybridSearch


class SearchService:
    def __init__(
        self,
        settings: Settings,
        db: SQLiteDatabase,
        hybrid: HybridSearch,
    ) -> None:
        self.settings = settings
        self.db = db
        self.hybrid = hybrid

    def search(
        self,
        query: str,
        *,
        top_k: int | None = None,
        mode: str = "hybrid",
    ) -> list[SearchHit]:
        k = top_k or self.settings.top_k
        prefer_keyword = mode in {"keyword", "recall"}

        if mode == "semantic":
            from app.database.models import SearchHit as SH

            results = self.hybrid.vector.search(query, limit=k)
            return [
                SH(chunk=c, semantic_score=s, hybrid_score=s) for c, s in results
            ]
        if mode == "keyword":
            from app.database.models import SearchHit as SH

            results = self.hybrid.keyword.search(query, limit=k)
            return [
                SH(chunk=c, keyword_score=s, hybrid_score=s) for c, s in results
            ]

        return self.hybrid.search(query, top_k=k, prefer_keyword=prefer_keyword)
