"""Grounded answer generation via Ollama."""

from __future__ import annotations

from app.database.models import ChatMode, ChatResult, ChunkRecord, SourceCitation
from app.llm.ollama_client import OllamaClient
from app.llm.prompts import ChatTurn, build_converse_messages, build_messages
from app.logging_config import get_logger

logger = get_logger(__name__)


def chunks_to_citations(chunks: list[ChunkRecord], preview_chars: int = 400) -> list[SourceCitation]:
    citations: list[SourceCitation] = []
    for chunk in chunks:
        preview = chunk.text.strip()
        if len(preview) > preview_chars:
            preview = preview[: preview_chars - 1] + "…"
        citations.append(
            SourceCitation(
                document_id=chunk.document_id,
                chunk_id=chunk.id,
                filename=chunk.filename,
                filepath=chunk.filepath,
                page=chunk.page_start,
                heading=chunk.heading,
                text_preview=preview,
                year=chunk.year,
                module=chunk.module,
                score=chunk.score,
                match_type=chunk.score_source,
            )
        )
    return citations


_CONVERSE_SYSTEM = """You are CharlesGPT — a capable local assistant for one student.

You hold multi-turn conversations and can use TOOL / WEB LOOKUP blocks when provided.
For questions about their college years/modules/files, you should normally be using the archive path —
if you only have chat context, say you need to dig into their Year folders and ask them to rephrase
with a year/module if nothing is available.

Rules:
- When tool data answers the student's actual question, USE IT.
- Never turn web search hits into unrelated trivia, song titles, or "fun facts".
- For greetings / small talk (hi, hello, how are you): reply briefly and warmly. No trivia.
- Do not invent generic college-life essays.
- Do not invent deadlines/demos from old memories unless the student just asked about them.
- Reply naturally and concisely.
"""


class AnswerGenerator:
    def __init__(self, ollama: OllamaClient) -> None:
        self.ollama = ollama

    def converse(
        self,
        message: str,
        history: list[ChatTurn] | None = None,
        web_note: str | None = None,
        web_sources: list[SourceCitation] | None = None,
    ) -> ChatResult:
        """Chat without college RAG — optional web lookup context."""
        messages = build_converse_messages(
            message=message,
            history=history,
            system=_CONVERSE_SYSTEM,
            web_note=web_note,
        )
        logger.info(
            "Conversational reply (history=%s, web=%s)",
            len(history or []),
            bool(web_note),
        )
        try:
            answer = self.ollama.chat(messages, temperature=0.5)
            text = (answer or "").strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Converse failed: %s", exc)
            text = ""
        if not text or len(text) < 8:
            text = (
                "Hey — I'm here. We can keep chatting, dig into your college materials, "
                "or look up a quick fact when you need context."
            )
        return ChatResult(
            answer=text,
            sources=list(web_sources or []),
            mode=ChatMode.ASK.value,
            model=self.ollama.chat_model,
        )

    def generate(
        self,
        question: str,
        chunks: list[ChunkRecord],
        mode: ChatMode = ChatMode.ASK,
        inventory_note: str | None = None,
        history: list[ChatTurn] | None = None,
        web_note: str | None = None,
        web_sources: list[SourceCitation] | None = None,
    ) -> ChatResult:
        if mode == ChatMode.SEARCH:
            return ChatResult(
                answer="",
                sources=chunks_to_citations(chunks),
                mode=mode.value,
                model=self.ollama.chat_model,
            )

        if not chunks and not inventory_note and not web_note:
            return ChatResult(
                answer=(
                    "I could not find enough evidence in your indexed college materials "
                    "or via web lookup. Try a different query, or keep chatting in Ask mode."
                ),
                sources=[],
                mode=mode.value,
                model=self.ollama.chat_model,
            )

        messages = build_messages(
            question=question,
            chunks=chunks,
            mode=mode,
            inventory_note=inventory_note,
            history=history,
            web_note=web_note,
        )
        logger.info(
            "Generating answer (mode=%s, sources=%s, history=%s, web=%s)",
            mode.value,
            len(chunks),
            len(history or []),
            bool(web_note),
        )
        temperature = 0.15 if history else (0.0 if mode in {ChatMode.ASK, ChatMode.RECALL, ChatMode.INTERVIEW} else 0.15)
        answer = self.ollama.chat(messages, temperature=temperature)
        sources = chunks_to_citations(chunks)
        if web_sources:
            sources = sources + list(web_sources)
        return ChatResult(
            answer=answer.strip(),
            sources=sources,
            mode=mode.value,
            model=self.ollama.chat_model,
        )
