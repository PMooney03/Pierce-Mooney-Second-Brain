"""Chat / RAG API."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import get_settings
from app.database.models import ChatMode
from app.deps import get_db, get_ollama, get_qdrant
from app.llm.answer_generator import AnswerGenerator
from app.llm.ollama_client import OllamaError
from app.retrieval.embeddings import EmbeddingService
from app.retrieval.hybrid_search import HybridSearch
from app.retrieval.keyword_search import KeywordSearch
from app.retrieval.vector_search import VectorSearch
from app.services.chat_service import ChatService
from app.services.search_service import SearchService

router = APIRouter(tags=["chat"])


class HistoryTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    mode: ChatMode = ChatMode.ASK
    top_k: int | None = Field(default=None, ge=1, le=50)
    history: list[HistoryTurn] = Field(default_factory=list)
    session_id: str | None = None


class SourceOut(BaseModel):
    document_id: int
    chunk_id: str
    filename: str
    filepath: str
    page: int | None = None
    heading: str | None = None
    text_preview: str
    year: str | None = None
    module: str | None = None
    score: float | None = None
    match_type: str | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceOut]
    mode: str
    model: str


def _chat_service() -> ChatService:
    settings = get_settings()
    db = get_db()
    embeddings = EmbeddingService(get_ollama())
    vector = VectorSearch(get_qdrant(), db, embeddings)
    keyword = KeywordSearch(db)
    hybrid = HybridSearch(vector, keyword)
    search = SearchService(settings, db, hybrid)
    generator = AnswerGenerator(get_ollama())
    return ChatService(settings, search, generator, db=db)


def _preflight(mode: ChatMode) -> None:
    if mode == ChatMode.SEARCH:
        return
    health = get_ollama().health()
    if not health.get("reachable"):
        raise HTTPException(status_code=503, detail=health.get("error") or "Ollama unavailable")
    if not health.get("chat_model_available"):
        raise HTTPException(
            status_code=503,
            detail=f"Chat model missing. Run: ollama pull {get_settings().ollama_chat_model}",
        )
    if not health.get("embed_model_available"):
        raise HTTPException(
            status_code=503,
            detail=f"Embed model missing. Run: ollama pull {get_settings().ollama_embed_model}",
        )


def _result_to_response(result) -> ChatResponse:
    return ChatResponse(
        answer=result.answer,
        sources=[
            SourceOut(
                document_id=s.document_id,
                chunk_id=s.chunk_id,
                filename=s.filename,
                filepath=s.filepath,
                page=s.page,
                heading=s.heading,
                text_preview=s.text_preview,
                year=s.year,
                module=s.module,
                score=getattr(s, "score", None),
                match_type=getattr(s, "match_type", None),
            )
            for s in result.sources
        ],
        mode=result.mode,
        model=result.model,
    )


@router.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    _preflight(req.mode)
    try:
        result = _chat_service().chat(
            req.message,
            mode=req.mode,
            top_k=req.top_k,
            history=[t.model_dump() for t in req.history],
            session_id=req.session_id,
        )
    except OllamaError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return _result_to_response(result)


@router.post("/api/chat/stream")
def chat_stream(req: ChatRequest) -> StreamingResponse:
    """NDJSON stream: status / file / answer / done — for live hive scanning."""
    _preflight(req.mode)

    def generate():
        try:
            for event in _chat_service().iter_chat(
                req.message,
                mode=req.mode,
                top_k=req.top_k,
                history=[t.model_dump() for t in req.history],
                session_id=req.session_id,
            ):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except OllamaError as exc:
            yield json.dumps({"event": "error", "message": str(exc)}) + "\n"
        except Exception as exc:  # noqa: BLE001
            yield json.dumps({"event": "error", "message": str(exc)}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
