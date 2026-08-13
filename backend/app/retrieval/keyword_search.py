"""Keyword / full-text search via SQLite FTS5."""

from __future__ import annotations

from app.database.models import ChunkRecord
from app.database.sqlite import SQLiteDatabase


class KeywordSearch:
    def __init__(self, db: SQLiteDatabase) -> None:
        self.db = db

    def search(self, query: str, limit: int = 10) -> list[tuple[ChunkRecord, float]]:
        results = self.db.keyword_search(query, limit=limit)
        for chunk, score in results:
            chunk.score = score
            chunk.score_source = "keyword"
        return results
