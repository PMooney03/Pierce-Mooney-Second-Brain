"""Persistent assistant memory (SQLite-backed)."""

from __future__ import annotations

import re

from app.database.sqlite import SQLiteDatabase

_REMEMBER_RE = re.compile(
    r"^\s*(?:please\s+)?(?:remember(?:\s+that)?|don't forget(?:\s+that)?|note that)\s*[:\-]?\s*(.+)$",
    re.I | re.S,
)
_REMEMBER_INLINE = re.compile(
    r"\bremember(?:\s+that)?\s+(.+)$",
    re.I | re.S,
)
_SHOW_RE = re.compile(
    r"\b("
    r"what do you remember|show(?:\s+me)?\s+(?:your\s+)?memories|"
    r"list(?:\s+your)?\s+memories|memory\s+bank"
    r")\b",
    re.I,
)
_FORGET_ALL_RE = re.compile(r"\b(forget everything|clear(?:\s+your)?\s+memory|wipe memories)\b", re.I)
_FORGET_RE = re.compile(r"^\s*(?:please\s+)?forget(?:\s+that)?\s*[:\-]?\s*(.+)$", re.I | re.S)


def extract_remember(message: str) -> str | None:
    text = message.strip()
    m = _REMEMBER_RE.match(text)
    if m:
        return m.group(1).strip()
    # Only treat short explicit remembers to avoid false positives
    if text.lower().startswith("remember"):
        m2 = _REMEMBER_INLINE.search(text)
        if m2:
            return m2.group(1).strip()
    return None


def wants_memory_list(message: str) -> bool:
    return bool(_SHOW_RE.search(message or ""))


def extract_forget(message: str) -> str | None:
    if _FORGET_ALL_RE.search(message or ""):
        return "__ALL__"
    m = _FORGET_RE.match((message or "").strip())
    if m:
        return m.group(1).strip()
    return None


def handle_memory_command(db: SQLiteDatabase, message: str) -> str | None:
    """Execute remember/forget/list; return a user-facing confirmation or None."""
    forget = extract_forget(message)
    if forget == "__ALL__":
        n = db.clear_memories()
        return f"Cleared {n} memor(ies)."
    if forget:
        n = db.delete_memories_matching(forget)
        return f"Forgot {n} memor(ies) matching that." if n else "I couldn't find a matching memory to forget."

    fact = extract_remember(message)
    if fact:
        mid = db.add_memory(fact)
        return f"Got it — I'll remember that (#{mid}): {fact}"

    if wants_memory_list(message):
        rows = db.list_memories(limit=30)
        if not rows:
            return "I don't have any saved memories yet. Say e.g. `remember that my exam is Friday`."
        lines = ["Here's what I remember:"]
        for r in reversed(rows):
            lines.append(f"- (#{r['id']}) {r['content']}")
        return "\n".join(lines)

    return None


def relevant_memories_block(db: SQLiteDatabase, message: str, limit: int = 8) -> str:
    """Only include memories that actually match the question — never dump the whole bank."""
    rows = db.search_memories(message, limit=limit)
    # search_memories falls back poorly; keep only rows with real token overlap
    tokens = [t for t in re.findall(r"[a-z0-9]{3,}", (message or "").lower()) if t]
    if not tokens:
        return ""
    filtered = []
    for r in rows:
        blob = (r.get("content") or "").lower()
        score = sum(1 for t in tokens if t in blob)
        if score >= 1:
            filtered.append(r)
    if not filtered:
        return ""
    lines = [
        "SAVED MEMORIES (only if clearly relevant to this question — ignore otherwise):",
    ]
    for r in filtered[:limit]:
        lines.append(f"- (#{r['id']}) {r['content']}")
    return "\n".join(lines)
