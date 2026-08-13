"""Assemble free local/web tool context for chat turns."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.config import Settings
from app.database.models import SourceCitation
from app.database.sqlite import SQLiteDatabase
from app.tools.calculator import try_calculate
from app.tools.datetime_info import current_datetime_block, wants_datetime
from app.tools.memory import handle_memory_command, relevant_memories_block
from app.tools.web_lookup import format_web_block, lookup as web_lookup, snippets_to_citations
from app.tools.weather import is_weather_query


@dataclass
class ToolBundle:
    note: str = ""
    sources: list[SourceCitation] = field(default_factory=list)
    direct_answer: str | None = None  # skip LLM when set (memory confirmations, etc.)


def gather_tools(
    message: str,
    *,
    settings: Settings,
    db: SQLiteDatabase | None,
    allow_web: bool,
    include_memory: bool = True,
) -> ToolBundle:
    parts: list[str] = []
    sources: list[SourceCitation] = []

    # Memory commands are deterministic.
    if db is not None:
        mem_reply = handle_memory_command(db, message)
        if mem_reply:
            return ToolBundle(direct_answer=mem_reply)
        if include_memory:
            mem_block = relevant_memories_block(db, message)
            if mem_block:
                parts.append(mem_block)

    if wants_datetime(message) or is_weather_query(message):
        parts.append("CLOCK:\n" + current_datetime_block())

    calc = try_calculate(message)
    if calc:
        expr, result = calc
        parts.append(
            f"CALCULATOR:\nExpression: {expr}\nResult: {result}\n"
            "Use this exact result. Do not recompute incorrectly."
        )
        sources.append(
            SourceCitation(
                document_id=0,
                chunk_id="tool:calc:1",
                filename=f"Calc · {expr} = {result}",
                filepath="local://calculator",
                page=None,
                heading="Calculator",
                text_preview=f"{expr} = {result}",
                year=None,
                module="Tools",
            )
        )

    if allow_web and settings.web_lookup_enabled:
        # Always try for weather; otherwise for non-trivial questions
        should = is_weather_query(message) or len(message.strip()) >= 8
        if should:
            snippets = web_lookup(message, timeout=settings.web_lookup_timeout)
            if snippets:
                parts.append(format_web_block(snippets))
                sources.extend(snippets_to_citations(snippets))

    note = "\n\n".join(parts).strip()
    return ToolBundle(note=note, sources=sources)
