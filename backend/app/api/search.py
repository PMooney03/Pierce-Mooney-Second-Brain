"""Search API (no LLM required)."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.config import get_settings
from app.deps import get_db, get_ollama, get_qdrant
from app.retrieval.embeddings import EmbeddingService
from app.retrieval.hybrid_search import HybridSearch
from app.retrieval.keyword_search import KeywordSearch
from app.retrieval.vector_search import VectorSearch
from app.services.search_service import SearchService

router = APIRouter(tags=["search"])


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int | None = Field(default=None, ge=1, le=50)
    mode: str = Field(default="hybrid", description="hybrid | semantic | keyword")


class SearchResultItem(BaseModel):
    chunk_id: str
    document_id: int
    filename: str
    filepath: str
    page_start: int | None = None
    page_end: int | None = None
    heading: str | None = None
    year: str | None = None
    module: str | None = None
    document_type: str | None = None
    text_preview: str
    text: str
    hybrid_score: float | None = None
    semantic_score: float | None = None
    keyword_score: float | None = None


class SearchResponse(BaseModel):
    query: str
    mode: str
    results: list[SearchResultItem]


def _search_service() -> SearchService:
    settings = get_settings()
    db = get_db()
    embeddings = EmbeddingService(get_ollama())
    vector = VectorSearch(get_qdrant(), db, embeddings)
    keyword = KeywordSearch(db)
    hybrid = HybridSearch(vector, keyword)
    return SearchService(settings, db, hybrid)


@router.post("/api/search", response_model=SearchResponse)
def search(req: SearchRequest) -> SearchResponse:
    service = _search_service()
    hits = service.search(req.query, top_k=req.top_k, mode=req.mode)
    items: list[SearchResultItem] = []
    for hit in hits:
        c = hit.chunk
        preview = c.text.strip()
        if len(preview) > 320:
            preview = preview[:319] + "…"
        items.append(
            SearchResultItem(
                chunk_id=c.id,
                document_id=c.document_id,
                filename=c.filename,
                filepath=c.filepath,
                page_start=c.page_start,
                page_end=c.page_end,
                heading=c.heading,
                year=c.year,
                module=c.module,
                document_type=c.document_type,
                text_preview=preview,
                text=c.text,
                hybrid_score=hit.hybrid_score,
                semantic_score=hit.semantic_score,
                keyword_score=hit.keyword_score,
            )
        )
    return SearchResponse(query=req.query, mode=req.mode, results=items)
