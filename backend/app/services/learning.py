"""Learn durable facts from chat turns into assistant_memory (local, no extra LLM)."""

from __future__ import annotations

import re
from typing import Any

from app.database.sqlite import SQLiteDatabase

_USER_FACT_RE = re.compile(
    r"("
    r"(?:i(?:'ve| have)?\s+finished\s+college[^.!?\n]{0,80})|"
    r"(?:i\s+(?:graduated|finished|completed)[^.!?\n]{0,80})|"
    r"(?:my\s+(?:name|course|degree|major|college|uni(?:versity)?)\s+is\s+[^.!?\n]{0,80})|"
    r"(?:i\s+(?:prefer|live\s+in|work\s+(?:at|on)|study)\s+[^.!?\n]{0,80})|"
    r"(?:don'?t\s+(?:remind|mention|bring\s+up)[^.!?\n]{0,80})"
    r")",
    re.I,
)

_CORRECTION_RE = re.compile(
    r"\b("
    r"there\s+is\s+no|that(?:'s|\s+is)\s+wrong|incorrect|i\s+never|"
    r"i\s+have\s+finished|months?\s+ago|not\s+(?:true|correct)|stop\s+(?:saying|assuming)"
    r")\b",
    re.I,
)


def _short(text: str, n: int = 100) -> str:
    t = re.sub(r"\s+", " ", (text or "").strip())
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


def extract_user_facts(question: str) -> list[str]:
    facts: list[str] = []
    q = (question or "").strip()
    if not q:
        return facts
    for m in _USER_FACT_RE.finditer(q):
        bit = m.group(0).strip(" .")
        if len(bit) >= 12:
            facts.append(f"User stated: {bit}")
    if _CORRECTION_RE.search(q) and len(q) >= 20:
        facts.append(f"User correction: {_short(q, 140)}")
    return facts


def learn_from_turn(
    db: SQLiteDatabase,
    *,
    question: str,
    answer: str,
    sources: list[dict[str, Any]] | None = None,
) -> list[int]:
    """Persist compact learnings from a Q&A. Returns new/updated memory ids."""
    ids: list[int] = []
    sources = sources or []

    for fact in extract_user_facts(question):
        mid = db.add_memory(fact, kind="learned")
        if mid:
            ids.append(mid)

    # Archive routing memory: where this topic lived
    if sources:
        areas: list[str] = []
        seen: set[str] = set()
        for s in sources[:10]:
            year = (s.get("year") or "").strip()
            module = (s.get("module") or "").strip()
            label = " / ".join(x for x in [year, module] if x)
            if not label or label in seen:
                continue
            seen.add(label)
            areas.append(label)
        if areas:
            topic = _short(question, 80)
            note = (
                f"From prior chat about “{topic}”: useful archive areas were "
                + "; ".join(areas[:5])
                + "."
            )
            mid = db.add_memory(note, kind="learned")
            if mid:
                ids.append(mid)

    # Keep learned bank from exploding — prune oldest learned beyond cap
    _prune_learned(db, keep=80)
    return ids


def _prune_learned(db: SQLiteDatabase, keep: int = 80) -> None:
    with db.connection() as conn:
        rows = conn.execute(
            """
            SELECT id FROM assistant_memory
            WHERE kind = 'learned'
            ORDER BY id DESC
            """
        ).fetchall()
        drop = [r["id"] for r in rows[keep:]]
        for mid in drop:
            conn.execute("DELETE FROM assistant_memory WHERE id = ?", (mid,))
