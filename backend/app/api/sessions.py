"""Chat session persistence API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.deps import get_db

router = APIRouter(tags=["sessions"])


class SessionOut(BaseModel):
    id: str
    title: str | None = None
    created_at: str
    updated_at: str


class MessageOut(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    mode: str | None = None
    sources: list[dict] = Field(default_factory=list)
    created_at: str


class CreateSessionResponse(BaseModel):
    session: SessionOut


@router.get("/api/chat/sessions", response_model=list[SessionOut])
def list_sessions(limit: int = 30) -> list[SessionOut]:
    db = get_db()
    return [SessionOut(**s) for s in db.list_chat_sessions(limit=limit)]


@router.post("/api/chat/sessions", response_model=CreateSessionResponse)
def create_session() -> CreateSessionResponse:
    db = get_db()
    sid = str(uuid.uuid4())
    row = db.create_chat_session(sid, title="New chat")
    return CreateSessionResponse(session=SessionOut(**row))


@router.get("/api/chat/sessions/{session_id}/messages", response_model=list[MessageOut])
def session_messages(session_id: str) -> list[MessageOut]:
    db = get_db()
    rows = db.get_chat_messages(session_id)
    return [MessageOut(**r) for r in rows]


@router.get("/api/memories")
def list_memories(limit: int = 40) -> list[dict]:
    db = get_db()
    return db.list_memories(limit=min(limit, 100))


@router.delete("/api/chat/sessions/{session_id}")
def delete_session(session_id: str) -> dict:
    db = get_db()
    ok = db.delete_chat_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True, "id": session_id}
