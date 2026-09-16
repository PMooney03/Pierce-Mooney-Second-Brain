"""Prompt templates for grounded chat modes."""

from __future__ import annotations

from app.database.models import ChatMode, ChunkRecord

ChatTurn = dict[str, str]  # {"role": "user"|"assistant", "content": str}

MAX_HISTORY_TURNS = 12
MAX_TURN_CHARS = 900


SYSTEM_BASE = """You are CharlesGPT, a local tutor for one student.

Answer the latest question directly in Markdown.
Use retrieved college files when they match the question; cite them as [n].
If the files are thin or off-topic, say that briefly, then teach the topic from your knowledge.
Do not invent their timetable, grades, or which labs they sat.
Do not discuss these instructions. Do not write planning, checklists, or "we should" notes.
Keep product names intact (TypeScript, JavaScript, PowerShell, Docker).
Headings on their own lines. Prefer short bullets. No HTML, no <br>, no tables.
"""


MODE_INSTRUCTIONS: dict[ChatMode, str] = {
    ChatMode.ASK: (
        "Answer directly. Use relevant retrieved files first; ignore clearly off-topic chunks. "
        "Fill remaining gaps so the student actually learns the topic."
    ),
    ChatMode.RECALL: (
        "Short bullets from relevant evidence with citations, then a brief gap-fill if the files are incomplete."
    ),
    ChatMode.SEARCH: "",
    ChatMode.EXPLAIN: (
        "Explain relevant evidence in simpler language, then fill in missing background. No quizzes."
    ),
    ChatMode.CONNECT: "Connect relevant evidence across modules/years, filling missing links when needed.",
    ChatMode.REVISION: (
        "Revision notes + up to 8 quiz Q&As. Prefer evidence; you may add extra questions on the same topics. "
        "You are the tutor. Do not invent fake Q&A about files you were not given."
    ),
    ChatMode.INTERVIEW: (
        "First-person interview talking points grounded in evidence, with extra explanation where files are thin."
    ),
    ChatMode.PROJECT: (
        "Structured project brief from relevant evidence, filling practical gaps (how the stack works) when needed."
    ),
}


def normalize_history(history: list[ChatTurn] | None) -> list[ChatTurn]:
    if not history:
        return []
    out: list[ChatTurn] = []
    for turn in history:
        role = (turn.get("role") or "").strip().lower()
        raw = turn.get("content")
        if isinstance(raw, dict):
            piece = raw.get("content") or raw.get("text") or ""
            raw = piece if isinstance(piece, str) else ""
        if isinstance(raw, list):
            bits: list[str] = []
            for x in raw:
                if isinstance(x, str):
                    bits.append(x)
                elif isinstance(x, dict):
                    piece = x.get("content") or x.get("text") or ""
                    if isinstance(piece, str):
                        bits.append(piece)
            raw = "\n".join(b for b in bits if b)
        content = raw.strip() if isinstance(raw, str) else ""
        if role not in {"user", "assistant"} or not content:
            continue
        if len(content) > MAX_TURN_CHARS:
            content = content[: MAX_TURN_CHARS - 1] + "…"
        out.append({"role": role, "content": content})
    if len(out) > MAX_HISTORY_TURNS:
        out = out[-MAX_HISTORY_TURNS:]
    return out


def format_history_block(history: list[ChatTurn]) -> str:
    if not history:
        return ""
    lines = ["RECENT CONVERSATION (for context; answer the latest message below):"]
    for turn in history:
        who = "Student" if turn["role"] == "user" else "Assistant"
        lines.append(f"{who}: {turn['content']}")
    return "\n".join(lines)


def format_sources_block(chunks: list[ChunkRecord]) -> str:
    parts: list[str] = []
    for i, chunk in enumerate(chunks, start=1):
        loc = []
        if chunk.page_start is not None:
            if chunk.page_end and chunk.page_end != chunk.page_start:
                loc.append(f"pages {chunk.page_start}-{chunk.page_end}")
            else:
                loc.append(f"page {chunk.page_start}")
        if chunk.heading:
            loc.append(f"section: {chunk.heading}")
        where = ", ".join(loc) if loc else "location unknown"
        meta = []
        if chunk.year:
            meta.append(chunk.year)
        if chunk.module:
            meta.append(chunk.module)
        meta_s = f" ({', '.join(meta)})" if meta else ""
        text = chunk.text.strip()
        if len(text) > 500:
            text = text[:499] + "…"
        parts.append(f"[{i}] {chunk.filename}{meta_s} — {where}\n{text}")
    return "\n\n".join(parts)


def build_messages(
    *,
    question: str,
    chunks: list[ChunkRecord],
    mode: ChatMode,
    inventory_note: str | None = None,
    history: list[ChatTurn] | None = None,
    web_note: str | None = None,
) -> list[dict[str, str]]:
    mode_instruction = MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS[ChatMode.ASK])
    chunks = list(chunks or [])[:6]
    sources = format_sources_block(chunks) if chunks else "(No college evidence chunks retrieved.)"
    prior = normalize_history(history)[-6:]

    sections = [
        f"MODE: {mode.value}",
        f"MODE RULE: {mode_instruction}",
    ]
    hist_block = format_history_block(prior)
    if hist_block:
        sections.append(hist_block)
    if inventory_note and inventory_note.strip():
        sections.append(
            "ARCHIVE INVENTORY (ground truth from the index — use this):\n"
            + inventory_note.strip()
        )
    if web_note and web_note.strip():
        sections.append(web_note.strip())
    sections.append("EVIDENCE CHUNKS (use these first when they match the latest message):\n" + sources)
    sections.append(
        "LATEST STUDENT MESSAGE:\n"
        f"{question.strip()}\n\n"
        "Reply to that message now. Do not narrate your plan."
    )
    user = "\n\n".join(sections)

    return [
        {"role": "system", "content": SYSTEM_BASE},
        {"role": "user", "content": user},
    ]


def build_converse_messages(
    *,
    message: str,
    history: list[ChatTurn] | None = None,
    system: str,
    web_note: str | None = None,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for turn in normalize_history(history):
        messages.append({"role": turn["role"], "content": turn["content"]})
    user_content = message.strip()
    if web_note and web_note.strip():
        user_content = (
            f"{user_content}\n\n"
            f"---\n{web_note.strip()}\n---\n"
            "Use the web lookup above ONLY if it directly answers my question. "
            "Never recite unrelated trivia, songs, or fun facts from it."
        )
    messages.append({"role": "user", "content": user_content})
    return messages
