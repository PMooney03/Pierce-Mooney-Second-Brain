"""Prompt templates for grounded chat modes."""

from __future__ import annotations

from app.database.models import ChatMode, ChunkRecord

ChatTurn = dict[str, str]  # {"role": "user"|"assistant", "content": str}

MAX_HISTORY_TURNS = 12
MAX_TURN_CHARS = 900


SYSTEM_BASE = """You are CharlesGPT for one student's local college archive.

You hold a multi-turn conversation. Prior turns are context.
Answer the LATEST student message using their indexed college files when present.

Hard rules:
- For questions about their years, modules, labs, or coursework: use EVIDENCE CHUNKS only.
- Summarise what the files show (modules, topics, document names). Cite as [n].
- NEVER invent a generic "typical first year of college" story.
- NEVER invent schedules, demos, deadlines, or life events that are not in evidence or clearly relevant saved memories.
- Ignore saved memories that conflict with the question or the files.
- Prefer learned/saved memories that clearly match the latest question (corrections, preferences, prior topic→archive routes).
- If evidence is thin, say what you found in the archive and ask a sharper follow-up.
- Output clean Markdown. Address the student as "you".
"""


MODE_INSTRUCTIONS: dict[ChatMode, str] = {
    ChatMode.ASK: (
        "Answer directly and helpfully. Ignore off-topic retrieved text. "
        "Do not stretch unrelated lecture snippets into an answer."
    ),
    ChatMode.RECALL: "Short bullets quoting/paraphrasing relevant evidence with citations.",
    ChatMode.SEARCH: "",
    ChatMode.EXPLAIN: "Explain relevant evidence in simpler language. No quizzes.",
    ChatMode.CONNECT: "Connect relevant evidence across modules/years.",
    ChatMode.REVISION: "Revision notes + up to 8 quiz Q&As from relevant evidence. You are the tutor.",
    ChatMode.INTERVIEW: "First-person interview talking points from relevant evidence only.",
    ChatMode.PROJECT: "Structured project brief from relevant evidence.",
}


def normalize_history(history: list[ChatTurn] | None) -> list[ChatTurn]:
    if not history:
        return []
    out: list[ChatTurn] = []
    for turn in history:
        role = (turn.get("role") or "").strip().lower()
        content = (turn.get("content") or "").strip()
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
        if len(text) > 1200:
            text = text[:1199] + "…"
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
    sources = format_sources_block(chunks) if chunks else "(No college evidence chunks retrieved.)"
    prior = normalize_history(history)

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
    sections.append("EVIDENCE CHUNKS (use only if relevant to the latest message):\n" + sources)
    sections.append(
        "LATEST STUDENT MESSAGE (answer this):\n"
        f"{question.strip()}\n\n"
        "Write the answer in Markdown now.\n"
        "Prefer college evidence for their coursework; use web lookup to fill gaps.\n"
        "If ARCHIVE INVENTORY lists modules/files for a year, summarise THAT year from the inventory + evidence — do not write a generic freshman essay.\n"
        "Follow topic changes. If college evidence is irrelevant, do not force it in.\n"
        "Do not create fake Q&A."
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
