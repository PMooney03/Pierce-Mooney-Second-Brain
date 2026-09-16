"""Chat / RAG orchestration."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Iterator

from app.config import Settings
from app.database.models import ChatMode, ChatResult, ChunkRecord, SearchHit, SourceCitation
from app.database.sqlite import SQLiteDatabase
from app.llm.answer_generator import AnswerGenerator, chunks_to_citations
from app.llm.prompts import ChatTurn, normalize_history
from app.services.search_service import SearchService
from app.services import search_trace as trace
from app.services.learning import learn_from_turn
from app.tools.memory import relevant_memories_block
from app.tools.toolkit import gather_tools
from app.tools.weather import is_weather_query


MODE_RETRIEVAL: dict[ChatMode, dict] = {
    ChatMode.ASK: {"top_k_factor": 1.5, "prefer_keyword": True},
    ChatMode.RECALL: {"top_k_factor": 1.5, "prefer_keyword": True},
    ChatMode.SEARCH: {"top_k_factor": 2.0, "prefer_keyword": True},
    ChatMode.EXPLAIN: {"top_k_factor": 1.25, "prefer_keyword": False},
    ChatMode.CONNECT: {"top_k_factor": 2.0, "prefer_keyword": True},
    ChatMode.REVISION: {"top_k_factor": 1.5, "prefer_keyword": False},
    ChatMode.INTERVIEW: {"top_k_factor": 2.0, "prefer_keyword": True},
    ChatMode.PROJECT: {"top_k_factor": 2.0, "prefer_keyword": True},
}

_EXPERIENCE_RE = re.compile(
    r"("
    r"\b(?:programming\s+)?languages?\b.*\b(?:appear|know|have|use|work|list|my|done|learned|studied)\b|"
    r"\b(?:coding|programming)\s+languages?\b|"
    r"\blanguages?\b.*\b(?:in|at|from)\s+college\b|"
    r"\bcollege\b.*\b(?:coding|programming|languages?)\b|"
    r"\btell\s+me\s+about\b.*\b(?:coding|programming|languages?|college)\b|"
    r"\b(?:what|which)\s+(?:programming\s+)?(?:languages?|technologies|skills?|tools?)\b|"
    r"\b(?:what|which)\s+experience\b|"
    r"\bwhat(?:'s| is)\s+my\s+.+\s+experience\b|"
    r"\bmy\s+\w+(?:\s+\w+)?\s+experience\b|"
    r"\bexperience\s+(?:do\s+i\s+have|have\s+i|with|in)\b|"
    r"\b(?:my|your)\s+(?:skills?|technologies|tech\s+stack|programming|coding)\b|"
    r"\btech\s+stack\b|"
    r"\b(?:coding|programming)\s+experience\b|"
    r"\bportfolio\b|"
    r"\bwhat\s+(?:can|do|have)\s+i\s+(?:code|program|know|use|build)\b|"
    r"\bhow\s+have\s+i\s+(?:used|done|built|written|applied)\b|"
    r"\bhave\s+i\s+(?:used|done|built|written|applied)\b|"
    r"\bwhere\s+(?:have|did)\s+i\s+(?:use|used|build|built|write|wrote)\b"
    r")",
    re.I,
)

# Capability / chat-scope questions — never dump the tech inventory or force RAG.
_META_SCOPE_RE = re.compile(
    r"\b("
    r"what can i (?:actually )?ask|"
    r"what (?:are you(?: for)?|can you(?: do)?|do you(?: do)?)\b|"
    r"can we talk|can i (?:ask|talk)|"
    r"only college|just college|college stuff"
    r")\b",
    re.I,
)

_ACADEMIC_HINT_RE = re.compile(
    r"\b("
    r"module|exam|lecture|assignment|lab|coursework|revision|"
    r"year\s*[1-4]|pdf|nis2|docker|kernel|network(?:ing)?|"
    r"summarise|summarize|my notes|my materials|my modules|"
    r"first\s+year|second\s+year|third\s+year|fourth\s+year|final\s+year|"
    r"year\s+one|year\s+two|year\s+three|year\s+four|"
    r"freshman|sophomore|junior\s+year|senior\s+year|"
    r"my\s+college|college\s+(?:files|materials|work|years?|archive)|"
    r"\bin\s+college\b|\bat\s+college\b|\bfrom\s+college\b|"
    r"what\s+did\s+i\s+(?:study|learn|do)|tell\s+me\s+about\s+(?:my|the|a)\b|"
    r"python|docker|kubernetes|linux|nis2|java\b|typescript|javascript|"
    r"powershell|\.ps1\b|ansible|vagrant|"
    r"my\s+projects?|(?:in|from|across|on)\s+my\s+projects?|"
    r"(?:a|the|which|what)\s+project(?:s)?\s+(?:i\s+)?(?:use|used|using|with|that)|"
    r"project\s+(?:i\s+)?(?:use|used|using)|"
    r"project\s+files?|portfolio\s+projects?"
    r")\b",
    re.I,
)

_YEAR_FOCUS_RE = re.compile(
    r"\b("
    r"year\s*(?P<n>[1-4])|"
    r"(?P<word>first|second|third|fourth|final|one|two|three|four)\s+year|"
    r"year\s+(?P<word2>one|two|three|four)|"
    r"(?P<us>freshman|sophomore)"
    r")\b",
    re.I,
)

_WORD_TO_YEAR = {
    "first": "1",
    "one": "1",
    "freshman": "1",
    "second": "2",
    "two": "2",
    "sophomore": "2",
    "third": "3",
    "three": "3",
    "fourth": "4",
    "four": "4",
    "final": "4",
}

_BROKEN_LLM_RE = re.compile(
    r"no user questions? provided|does not include any specific questions|"
    r"if you'?d like,? i can help|respond as if i were a student|"
    r"can someone explain",
    re.I,
)

_PLANNING_RE = re.compile(
    r"we need to answer|we must (use|not)|the instruction|"
    r"put a space between every word|never concatenate words|"
    r"none of these mention|write the answer in markdown now|"
    r"we should (not )?mention|because it'?s a personal statement",
    re.I,
)

_ROUTING_MEMORY_RE = re.compile(r"useful archive areas were|from prior chat about", re.I)

_OPEN_QUERY_RE = re.compile(
    r"\b(tell me about|what is|what's|who is|who's|what are|where is|where's|when is|when's)\b",
    re.I,
)

_ARCHIVE_STOPWORDS = frozenset({
    "the", "and", "for", "about", "what", "tell", "how", "when", "where", "who",
    "my", "your", "have", "has", "was", "were", "are", "from", "this", "that",
    "with", "did", "does", "can", "could", "would", "should", "please",
    "is", "are", "was", "were", "been", "being", "any", "some", "much",
})

# Common academic words that match too many unrelated lecture PDFs.
_VAGUE_QUERY_WORDS = frozenset({
    "electric", "electrical", "electricity", "computer", "computing", "data",
    "system", "systems", "network", "networking", "security", "digital",
    "software", "hardware", "information", "technology", "technical",
    "introduction", "intro", "basic", "basics", "fundamentals", "overview",
    "lecture", "slides", "notes", "lab", "labs", "assignment", "module",
})

TECH_TERMS = [
    "Java",
    "Python",
    "PHP",
    "Kotlin",
    "JavaScript",
    "TypeScript",
    "SQL",
    "HTML",
    "CSS",
    "C++",
    "Docker",
    "Ansible",
    "Kubernetes",
    "Git",
    "Linux",
    "Bash",
    "Android",
    "MQTT",
    "PostgreSQL",
    "MySQL",
    "Vagrant",
    "Grafana",
    "Prometheus",
    "Retrofit",
]

STRICT_TECH_TERMS = {"SQL", "Git", "CSS", "HTML", "Bash"}


def _term_matched(term: str, chunk: ChunkRecord) -> bool:
    blob = f"{chunk.text}\n{chunk.filename}\n{chunk.filepath}\n{chunk.module or ''}\n{chunk.heading or ''}"
    pattern = r"(?<![A-Za-z0-9_])" + re.escape(term) + r"(?![A-Za-z0-9_])"
    if not re.search(pattern, blob, flags=re.I):
        return False
    if term in STRICT_TECH_TERMS:
        pathish = f"{chunk.filename} {chunk.filepath} {chunk.module or ''}"
        return bool(re.search(pattern, pathish, flags=re.I)) or term.lower() in chunk.text.lower()[:400]
    return True


_FOLLOWUP_RE = re.compile(
    r"^\s*("
    r"tell me more(?:\s+about\s+.{0,40})?|more(?:\s+detail(?:s)?)?|go on|continue|"
    r"and\??|why\??|how\??|what else|anything else|"
    r"what about .{2,50}|how about .{2,50}|same for .{2,50}|also .{2,60}|"
    r"explain (?:that|this|it)|summarise (?:that|this|it)|summarize (?:that|this|it)|"
    r"expand(?:\s+on\s+that)?"
    r")[\s?!.]*$",
    re.I,
)


_SKIP_WEB_RE = re.compile(
    r"^\s*("
    r"hi|hello|hey|yo|sup|hiya|howdy|"
    r"how are you(?: doing)?|how's it going|whats? up|what'?s up|"
    r"thanks|thank you|ty|ok|okay|cool|nice|great|test|testing"
    r")[\s!?.]*$",
    re.I,
)

# "hello how are you", "hey there", "hi charles" — not real search queries
_SMALLTALK_RE = re.compile(
    r"^\s*(?:hi|hello|hey|yo|sup|hiya|howdy)\b"
    r"(?:[\s,!.-]+(?:there|again|charles|charlesgpt|mate|man|bro|dude)?)?"
    r"(?:[\s,!.-]+(?:how are you(?: doing)?|how's it going|whats? up|what'?s up))?"
    r"[\s!?.]*$",
    re.I,
)


def _looks_like_planning(text: str) -> bool:
    """True when gpt-oss dumped prompt-reasoning instead of an answer."""
    t = (text or "").strip()
    if not t:
        return False
    if _PLANNING_RE.search(t):
        return True
    low = t.lower()
    return low.count("we should") >= 3 or low.count("we must") >= 3


def _is_smalltalk(message: str) -> bool:
    text = (message or "").strip()
    if not text:
        return True
    if _SKIP_WEB_RE.match(text) or _SMALLTALK_RE.match(text):
        return True
    return False


def _year_focus(message: str) -> str | None:
    """Return 'Year N' if the question targets a specific college year."""
    m = _YEAR_FOCUS_RE.search(message or "")
    if not m:
        return None
    if m.groupdict().get("n"):
        return f"Year {m.group('n')}"
    word = (m.groupdict().get("word") or m.groupdict().get("word2") or m.groupdict().get("us") or "").lower()
    n = _WORD_TO_YEAR.get(word)
    return f"Year {n}" if n else None


def _is_experience_question(message: str) -> bool:
    if _META_SCOPE_RE.search(message):
        return False
    if _EXPERIENCE_RE.search(message):
        return True
    if re.search(r"\bexperience\b", message or "", re.I) and _tech_focus_terms(message):
        return True
    return False


def _tech_focus_terms(message: str) -> list[str]:
    """Technology names explicitly mentioned in the question."""
    text = message or ""
    found: list[str] = []
    for term in TECH_TERMS:
        pattern = r"(?<![A-Za-z0-9_])" + re.escape(term) + r"(?![A-Za-z0-9_])"
        if re.search(pattern, text, flags=re.I):
            found.append(term)
    return found


def _has_college_intent(message: str) -> bool:
    return bool(
        _ACADEMIC_HINT_RE.search(message)
        or _EXPERIENCE_RE.search(message)
        or _year_focus(message)
        or _tech_focus_terms(message)
    )


def _looks_like_open_domain_question(message: str) -> bool:
    """General knowledge / real-world — not the student's college archive."""
    if _has_college_intent(message):
        return False
    if _OPEN_QUERY_RE.search(message or ""):
        return True
    if re.search(r"\b(festival|concert|gig|tickets?|movie|film|album|celebrity)\b", message or "", re.I):
        return True
    return False


def _distinctive_query_tokens(message: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9]{3,}", (message or "").lower())
    return [t for t in tokens if t not in _ARCHIVE_STOPWORDS and t not in _VAGUE_QUERY_WORDS]


def _archive_hits_relevant(message: str, chunks: list[ChunkRecord]) -> bool:
    """True when retrieved chunks actually mention the query's distinctive terms."""
    distinct = _distinctive_query_tokens(message)
    if not distinct:
        return True
    blob = ""
    for c in chunks[:10]:
        blob += f" {c.text} {c.filename} {c.filepath} {c.module or ''} {c.heading or ''}".lower()
    matched = sum(1 for t in distinct if t in blob)
    if len(distinct) == 1:
        return matched >= 1
    return matched >= len(distinct)


def _answer_needs_evidence_fallback(
    answer: str, chunks: list[ChunkRecord], *, question: str = ""
) -> bool:
    """True only for routing-memory garbage — never used to dump chunk previews."""
    if not chunks:
        return False
    if question and not _archive_hits_relevant(question, chunks):
        return False
    return bool(_ROUTING_MEMORY_RE.search((answer or "").strip()))


def _archive_lead_in(
    question: str,
    chunks: list[ChunkRecord],
    inventory_note: str | None = None,
) -> str:
    """Readable RAG lead-in when the chat model returns no text."""
    lines: list[str] = []
    q = (question or "").strip()
    if q:
        lines.append(f"From your indexed files, this is what matches **{q[:120]}**:")
        lines.append("")
    if inventory_note and inventory_note.strip():
        lines.append(inventory_note.strip())
        lines.append("")
    if chunks:
        lines.append("## From your files")
        for i, c in enumerate(chunks[:8], start=1):
            loc = ", ".join(x for x in [c.year, c.module] if x) or (c.heading or "section unknown")
            preview = (c.text or "").strip().replace("\n", " ")
            if len(preview) > 220:
                preview = preview[:217] + "…"
            lines.append(f"- [{i}] **{c.filename}** ({loc}) — {preview}")
    return "\n".join(lines).strip()


def _is_followup(message: str) -> bool:
    return bool(_FOLLOWUP_RE.match(message.strip()))


def _prior_was_academic(history: list[ChatTurn]) -> bool:
    for turn in reversed(history):
        content = turn.get("content") or ""
        if turn.get("role") == "user":
            return bool(
                _ACADEMIC_HINT_RE.search(content) or _EXPERIENCE_RE.search(content)
            )
        if turn.get("role") == "assistant" and re.search(r"\[\d+\]", content):
            return True
    return False


def _wants_archive(message: str, history: list[ChatTurn], mode: ChatMode) -> bool:
    """Whether this turn should retrieve college materials."""
    if mode != ChatMode.ASK:
        return True
    if _META_SCOPE_RE.search(message):
        return False
    if _is_smalltalk(message):
        return False
    # Utility / everyday tools — don't force college RAG
    if is_weather_query(message):
        return False
    from app.tools.calculator import wants_calculation
    from app.tools.datetime_info import wants_datetime
    from app.tools.memory import extract_forget, extract_remember, wants_memory_list

    if (
        wants_datetime(message)
        or wants_calculation(message)
        or extract_remember(message)
        or extract_forget(message)
        or wants_memory_list(message)
    ):
        return False
    if _is_followup(message) and not _prior_was_academic(history):
        # Vague follow-up after small talk — stay conversational
        return False
    # Tools/topics that live in the archive should always retrieve first.
    if _has_college_intent(message):
        return True
    if _looks_like_open_domain_question(message):
        return False
    # Ask mode default: search archive first; answer from what's useful.
    return True


def _should_web_lookup(message: str, mode: ChatMode, *, enabled: bool) -> bool:
    if not enabled:
        return False
    if mode in {ChatMode.SEARCH, ChatMode.INTERVIEW, ChatMode.RECALL}:
        return False
    text = message.strip()
    if _is_smalltalk(text):
        return False
    # Allow short weather asks like "weather?"
    from app.tools.weather import is_weather_query

    if is_weather_query(text):
        return True
    if len(text) < 8:
        return False
    return True


def _retrieval_query(message: str, history: list[ChatTurn]) -> str:
    """Expand short follow-ups using the last user question."""
    msg = message.strip()
    year = _year_focus(msg)
    if year:
        # Bias hybrid search toward that year's materials
        return f"{msg}\n{year} modules lectures labs coursework notes"

    if not history:
        return msg
    if not _is_followup(msg) and len(re.findall(r"[A-Za-z0-9]+", msg)) >= 5:
        return msg
    prior_users = [h["content"] for h in history if h.get("role") == "user"]
    if not prior_users:
        return msg
    anchor = prior_users[-1].strip()
    if anchor.lower() == msg.lower():
        return msg
    return f"{anchor}\n\nFollow-up: {msg}"


def _is_year_overview(message: str) -> bool:
    """Broad 'tell me about year N' questions need inventory, not a random RAG hit."""
    if not _year_focus(message):
        return False
    return bool(
        re.search(
            r"\b("
            r"tell\s+me\s+about|overview|summar(?:y|ise|ize)|"
            r"what\s+(?:was|were|about)|describe|walk\s+me\s+through|"
            r"how\s+was|look\s+like"
            r")\b",
            message,
            re.I,
        )
    )


def _year_inventory_note(db: SQLiteDatabase, year: str) -> str:
    modules = db.list_modules(year=year)
    docs = db.list_documents(year=year, status="active")
    if not modules and not docs:
        return f"No indexed documents found for {year}."
    lines = [
        f"{year} archive index:",
        f"- Documents indexed: {len(docs)}",
        f"- Modules: {len(modules)}",
    ]
    for m in modules:
        lines.append(f"  · {m.get('name')}: {m.get('document_count', 0)} files")
    # A few sample filenames so the model can cite concrete materials
    samples = [d.filename for d in docs[:12]]
    if samples:
        lines.append("- Example files: " + "; ".join(samples))
    return "\n".join(lines)


def _prefer_year_chunks(chunks: list[ChunkRecord], year: str | None, limit: int) -> list[ChunkRecord]:
    if not year:
        return chunks[:limit]
    matched = [c for c in chunks if (c.year or "") == year or year.lower() in (c.filepath or "").lower()]
    if matched:
        rest = [c for c in chunks if c not in matched]
        return (matched + rest)[:limit]
    return chunks[:limit]


def _dedupe_chunks(chunks: list[ChunkRecord], limit: int) -> list[ChunkRecord]:
    seen: set[str] = set()
    out: list[ChunkRecord] = []
    for chunk in chunks:
        if chunk.id in seen:
            continue
        seen.add(chunk.id)
        out.append(chunk)
        if len(out) >= limit:
            break
    return out


def _hits_to_chunks(hits: list[SearchHit]) -> list[ChunkRecord]:
    return [h.chunk for h in hits]


def _citation_is_duckduckgo(source: Any) -> bool:
    if isinstance(source, dict):
        heading = str(source.get("heading") or "")
        chunk_id = str(source.get("chunk_id") or "")
        module = str(source.get("module") or "")
    else:
        heading = str(getattr(source, "heading", None) or "")
        chunk_id = str(getattr(source, "chunk_id", None) or "")
        module = str(getattr(source, "module", None) or "")
    return (
        heading == "DuckDuckGo"
        or chunk_id.startswith("web:ddg")
        or module == "DuckDuckGo"
        or (module == "Web lookup" and "duckduckgo" in heading.lower())
    )


def _citation_is_web(source: Any) -> bool:
    if isinstance(source, dict):
        chunk_id = str(source.get("chunk_id") or "")
        module = str(source.get("module") or "")
    else:
        chunk_id = str(getattr(source, "chunk_id", None) or "")
        module = str(getattr(source, "module", None) or "")
    return chunk_id.startswith("web:") or module == "Web lookup"


def _citation_is_archive(source: Any) -> bool:
    if isinstance(source, dict):
        chunk_id = str(source.get("chunk_id") or "")
        doc_id = int(source.get("document_id") or 0)
    else:
        chunk_id = str(getattr(source, "chunk_id", None) or "")
        doc_id = int(getattr(source, "document_id", 0) or 0)
    if chunk_id.startswith("web:") or chunk_id.startswith("tool:"):
        return False
    return doc_id > 0 or bool(chunk_id)


def _retrieval_kind(*, used_archive: bool, sources: list[Any]) -> str:
    """Label how evidence was gathered for the UI."""
    has_ddg = any(_citation_is_duckduckgo(s) for s in sources)
    has_web = any(_citation_is_web(s) for s in sources)
    has_archive = used_archive or any(_citation_is_archive(s) for s in sources)
    if has_archive and has_ddg:
        return "archive+web"
    if has_archive and has_web:
        return "archive+web"
    if has_archive:
        return "archive"
    if has_ddg:
        return "web"
    if has_web:
        return "web"
    return "tools"


def _duckduckgo_status(sources: list[Any], *, with_archive: bool) -> str | None:
    if not any(_citation_is_duckduckgo(s) for s in sources):
        return None
    if with_archive:
        return "DuckDuckGo web lookup (alongside your college files)…"
    return "DuckDuckGo web lookup (not searching your college files)…"


def _citation_payload(s: SourceCitation) -> dict[str, Any]:
    return {
        "document_id": s.document_id,
        "chunk_id": s.chunk_id,
        "filename": s.filename,
        "filepath": s.filepath,
        "page": s.page,
        "heading": s.heading,
        "text_preview": s.text_preview,
        "year": s.year,
        "module": s.module,
        "score": s.score,
        "match_type": s.match_type,
    }


def _emit_files(citations: list[SourceCitation], *, node: str = "archive") -> Iterator[dict[str, Any]]:
    seen: set[str] = set()
    for s in citations:
        key = s.chunk_id or f"{s.filename}:{s.page}"
        if key in seen:
            continue
        seen.add(key)
        yield {"event": "file", "source": _citation_payload(s), "node": node}


class ChatService:
    def __init__(
        self,
        settings: Settings,
        search: SearchService,
        generator: AnswerGenerator,
        db: SQLiteDatabase | None = None,
    ) -> None:
        self.settings = settings
        self.search = search
        self.generator = generator
        self.db = db

    def _tool_bundle(self, message: str, mode: ChatMode, *, include_memory: bool = True):
        allow_web = _should_web_lookup(
            message, mode, enabled=self.settings.web_lookup_enabled
        ) or is_weather_query(message)
        return gather_tools(
            message,
            settings=self.settings,
            db=self.db,
            allow_web=allow_web,
            include_memory=include_memory,
        )

    def _iter_converse_answer(
        self,
        message: str,
        prior: list[ChatTurn],
        session_id: str | None,
        mode: ChatMode,
        *,
        status: str = "Checking tools…",
    ) -> Iterator[dict[str, Any]]:
        yield {"event": "status", "message": status, "node": "reason"}
        tools = self._tool_bundle(message, mode)
        ddg_msg = _duckduckgo_status(tools.sources, with_archive=False)
        if ddg_msg:
            yield {"event": "status", "message": ddg_msg, "node": "web"}
            yield {
                "event": "retrieval",
                "kind": "web",
                "provider": "DuckDuckGo",
                "message": ddg_msg,
            }
        elif tools.sources:
            yield {"event": "status", "message": "Gathering live context…", "node": "web"}
        for s in tools.sources:
            node = (
                "weather"
                if (s.heading or "").lower() == "open-meteo" or "weather" in (s.filename or "").lower()
                else "web"
            )
            if (s.module or "") == "Tools":
                node = "calc"
            if _citation_is_duckduckgo(s):
                node = "web"
            yield {"event": "file", "source": _citation_payload(s), "node": node}
        if tools.direct_answer:
            sources = [_citation_payload(s) for s in tools.sources]
            retrieval = _retrieval_kind(used_archive=False, sources=sources)
            learned = self._persist_turn(
                session_id,
                message=message,
                answer=tools.direct_answer,
                mode=mode,
                sources=sources,
                retrieval=retrieval,
            )
            yield {
                "event": "answer",
                "answer": tools.direct_answer,
                "sources": sources,
                "mode": mode.value,
                "model": "tools",
                "retrieval": retrieval,
            }
            yield learned
            yield {"event": "done"}
            return
        yield {"event": "status", "message": "Composing answer…", "node": "reason"}
        parts: list[str] = []
        for token in self.generator.iter_converse(
            message,
            history=prior,
            web_note=tools.note or None,
        ):
            if not token:
                continue
            parts.append(token)
            yield {"event": "token", "text": token}
        answer_text = "".join(parts).strip()
        if not answer_text or len(answer_text) < 8:
            answer_text = (
                "Hey — I'm here. We can keep chatting, dig into your college materials, "
                "or look up a quick fact when you need context."
            )
            yield {"event": "token", "text": answer_text}
        sources = [_citation_payload(s) for s in tools.sources]
        retrieval = _retrieval_kind(used_archive=False, sources=sources)
        learned = self._persist_turn(
            session_id,
            message=message,
            answer=answer_text,
            mode=mode,
            sources=sources,
            retrieval=retrieval,
        )
        yield {
            "event": "answer",
            "answer": answer_text,
            "sources": sources,
            "mode": mode.value,
            "model": self.generator.ollama.chat_model,
            "retrieval": retrieval,
        }
        yield learned
        yield {"event": "done"}

    def _collect_tech(
        self,
        terms: list[str] | None = None,
        *,
        per_term: int = 3,
    ) -> dict[str, list[ChunkRecord]]:
        by_term: dict[str, list[ChunkRecord]] = defaultdict(list)
        for term in terms or TECH_TERMS:
            results = self.search.hybrid.keyword.search(term, limit=per_term)
            for chunk, _score in results:
                if _term_matched(term, chunk):
                    by_term[term].append(chunk)
        return by_term

    def chat(
        self,
        message: str,
        *,
        mode: ChatMode = ChatMode.ASK,
        top_k: int | None = None,
        history: list[ChatTurn] | None = None,
        session_id: str | None = None,
    ) -> ChatResult:
        result: ChatResult | None = None
        for event in self.iter_chat(
            message, mode=mode, top_k=top_k, history=history, session_id=session_id
        ):
            if event.get("event") == "answer":
                result = ChatResult(
                    answer=event["answer"],
                    sources=[
                        SourceCitation(**s) for s in event.get("sources", [])
                    ],
                    mode=event.get("mode", mode.value),
                    model=event.get("model", self.generator.ollama.chat_model),
                )
        if result is None:
            return ChatResult(
                answer="No response produced.",
                sources=[],
                mode=mode.value,
                model=self.generator.ollama.chat_model,
            )
        return result

    def _persist_turn(
        self,
        session_id: str | None,
        *,
        message: str,
        answer: str,
        mode: ChatMode,
        sources: list[dict[str, Any]],
        retrieval: str | None = None,
    ) -> dict[str, Any]:
        """Save chat + learn. Returns a payload suitable for a stream `learned` event."""
        out: dict[str, Any] = {
            "event": "learned",
            "session_saved": False,
            "memory_ids": [],
            "memories": [],
            "message": "",
        }
        if not self.db:
            out["message"] = "No database — nothing saved"
            return out
        try:
            if session_id:
                self.db.add_chat_message(session_id, role="user", content=message, mode=mode.value)
                self.db.add_chat_message(
                    session_id,
                    role="assistant",
                    content=answer,
                    mode=mode.value,
                    sources=sources,
                    retrieval=retrieval,
                )
                out["session_saved"] = True
            ids = learn_from_turn(self.db, question=message, answer=answer, sources=sources)
            out["memory_ids"] = ids
            memories: list[dict[str, Any]] = []
            if ids:
                recent = self.db.list_memories(limit=12)
                by_id = {int(r["id"]): r for r in recent}
                for mid in ids:
                    row = by_id.get(int(mid))
                    if row:
                        memories.append(
                            {
                                "id": row["id"],
                                "content": row["content"],
                                "kind": row.get("kind") or "learned",
                            }
                        )
                out["memories"] = memories
            if out["session_saved"] and memories:
                out["message"] = f"Saved chat · learned {len(memories)} thing{'s' if len(memories) != 1 else ''}"
            elif out["session_saved"]:
                out["message"] = "Saved to this chat"
            elif memories:
                out["message"] = f"Learned {len(memories)} thing{'s' if len(memories) != 1 else ''}"
            else:
                out["message"] = "Turn complete (nothing new to learn)"
        except Exception:  # noqa: BLE001
            out["message"] = "Save/learn failed"
        return out

    def iter_chat(
        self,
        message: str,
        *,
        mode: ChatMode = ChatMode.ASK,
        top_k: int | None = None,
        history: list[ChatTurn] | None = None,
        session_id: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        """Yield hive progress events, then a final answer event."""
        prior = normalize_history(history)

        # Open conversation / tools — optional web/weather/calc/memory, no college RAG.
        if mode == ChatMode.ASK and not _wants_archive(message, prior, mode):
            yield from self._iter_converse_answer(message, prior, session_id, mode)
            return

        cfg = MODE_RETRIEVAL.get(mode, MODE_RETRIEVAL[ChatMode.ASK])
        base_k = top_k or self.settings.top_k
        k = max(1, int(base_k * float(cfg["top_k_factor"])))
        retrieve_k = min(max(k * 2, 12), 28)

        extra_hits: list[SearchHit] = []
        if _is_experience_question(message) and mode in {
            ChatMode.ASK,
            ChatMode.RECALL,
            ChatMode.INTERVIEW,
            ChatMode.CONNECT,
        }:
            yield {
                "event": "status",
                "message": "Scanning technology mentions in your archive…",
                "node": "archive",
            }
            focus_terms = _tech_focus_terms(message)
            if focus_terms and (
                re.search(r"\bexperience\b", message, re.I)
                or re.search(r"\bmy\s+", message, re.I)
            ):
                by_term = self._collect_tech(focus_terms, per_term=5)
            else:
                by_term = self._collect_tech()
            seen_tech: set[str] = set()
            for term_chunks in by_term.values():
                for chunk in term_chunks:
                    if chunk.id in seen_tech:
                        continue
                    seen_tech.add(chunk.id)
                    extra_hits.append(
                        SearchHit(
                            chunk=chunk,
                            semantic_score=None,
                            keyword_score=chunk.score,
                            hybrid_score=chunk.score or 0.05,
                        )
                    )

        year = _year_focus(message)
        project_focus = bool(
            re.search(
                r"\b(project|fyp|final\s+year\s+project|docker|ansible|infrastructure)\b",
                message,
                re.I,
            )
        ) or mode == ChatMode.PROJECT
        expand_modules = bool(year and _is_year_overview(message))

        yield {
            "event": "status",
            "message": "Searching your college archive (RAG)…",
            "node": "archive",
        }
        yield {
            "event": "retrieval",
            "kind": "archive",
            "provider": "local",
            "message": "Searching your college archive (RAG)…",
        }
        yield from trace.iter_pre_search_trace(
            self.db,
            query=message,
            mode=mode,
            year_focus=year,
            project_focus=project_focus,
            expand_modules=expand_modules,
        )
        if year:
            yield {"event": "status", "message": f"Focusing on {year}…", "node": "archive"}

        query = _retrieval_query(message, prior)
        hits = self.search.hybrid.search(
            query,
            top_k=retrieve_k,
            prefer_keyword=bool(cfg["prefer_keyword"]),
        )
        if extra_hits:
            hits = extra_hits + hits

        if year:
            matched_hits = [
                h
                for h in hits
                if (h.chunk.year or "") == year
                or year.lower() in (h.chunk.filepath or "").lower()
            ]
            if matched_hits:
                rest = [h for h in hits if h not in matched_hits]
                hits = (matched_hits + rest)[:retrieve_k]

        seen_ids: set[str] = set()
        deduped_hits: list[SearchHit] = []
        for h in hits:
            if h.chunk.id in seen_ids:
                continue
            seen_ids.add(h.chunk.id)
            deduped_hits.append(h)
            if len(deduped_hits) >= retrieve_k:
                break
        hits = deduped_hits[:k]

        inventory_note: str | None = None
        if year and self.db and _is_year_overview(message):
            yield {
                "event": "status",
                "message": f"Mapping {year} modules -> files…",
                "node": "archive",
            }
            inventory_note = _year_inventory_note(self.db, year)
            sampled = self.db.sample_year_chunks(year, per_module=2, max_chunks=max(k, 12))
            sample_hits = [
                SearchHit(
                    chunk=c,
                    semantic_score=None,
                    keyword_score=None,
                    hybrid_score=c.score or 0.01,
                )
                for c in sampled
                if c.id not in seen_ids
            ]
            hits = (sample_hits + hits)[: max(k, 14)]

        yield from trace.iter_hit_trace(hits, limit=trace.MAX_MATCH_EVENTS)

        chunks = [h.chunk for h in hits]
        chunks = _prefer_year_chunks(chunks, year, limit=max(k, 14) if year else k)
        for h in hits:
            h.chunk.score = h.hybrid_score or h.chunk.score
            h.chunk.score_source = trace.match_type_for_hit(h)

        if (
            mode == ChatMode.ASK
            and chunks
            and not _has_college_intent(message)
            and not _archive_hits_relevant(message, chunks)
        ):
            yield from self._iter_converse_answer(
                message,
                prior,
                session_id,
                mode,
                status="No matching college material — answering from general knowledge…",
            )
            return

        cites = chunks_to_citations(chunks, preview_chars=500 if mode == ChatMode.SEARCH else 420)

        # Prefer learned/explicit memories; skip noisy web for year-focused questions
        tools = self._tool_bundle(
            query,
            mode,
            include_memory=True,
        )
        if year:
            mem_note = ""
            if self.db:
                mem_note = relevant_memories_block(self.db, message) or ""
            tools = type(tools)(note=mem_note, sources=[], direct_answer=None)
        else:
            ddg_msg = _duckduckgo_status(tools.sources, with_archive=True)
            if ddg_msg:
                yield {"event": "status", "message": ddg_msg, "node": "web"}
                yield {
                    "event": "retrieval",
                    "kind": "archive+web",
                    "provider": "DuckDuckGo",
                    "message": ddg_msg,
                }
            elif tools.sources:
                yield {"event": "status", "message": "Enriching with tools…", "node": "web"}
            for s in tools.sources:
                node = "web"
                if (s.heading or "") == "Open-Meteo" or "Weather" in (s.filename or ""):
                    node = "weather"
                if (s.module or "") == "Tools":
                    node = "calc"
                if _citation_is_duckduckgo(s):
                    node = "web"
                yield {"event": "file", "source": _citation_payload(s), "node": node}

        if mode == ChatMode.SEARCH:
            sources = [_citation_payload(s) for s in cites]
            yield trace.emit_sources_selected([c.chunk_id for c in cites])
            learned = self._persist_turn(
                session_id,
                message=message,
                answer="",
                mode=mode,
                sources=sources,
                retrieval="archive",
            )
            yield {
                "event": "answer",
                "answer": "",
                "sources": sources,
                "mode": mode.value,
                "model": self.generator.ollama.chat_model,
                "retrieval": "archive",
            }
            yield learned
            yield trace.emit_trace_complete()
            yield {"event": "done"}
            return

        yield trace.emit_phase("compose", "Composing answer…")
        yield {"event": "status", "message": "Composing answer…", "node": "reason"}
        yield trace.emit_sources_selected([c.chunk_id for c in cites])
        parts: list[str] = []
        for token in self.generator.iter_generate(
            message,
            chunks,
            mode=mode,
            history=prior,
            inventory_note=inventory_note,
            web_note=tools.note or None,
        ):
            if not isinstance(token, str) or not token:
                continue
            parts.append(token)
            yield {"event": "token", "text": token}
        answer_text = "".join(parts).strip()
        if _looks_like_planning(answer_text):
            yield {
                "event": "status",
                "message": "Retrying — the model started planning instead of answering…",
                "node": "reason",
            }
            retry_bits: list[str] = []
            first = True
            try:
                for token in self.generator.iter_converse(
                    message,
                    history=[],
                    web_note=tools.note or None,
                ):
                    if not isinstance(token, str) or not token:
                        continue
                    retry_bits.append(token)
                    if first:
                        yield {"event": "token", "text": token, "replace": True}
                        first = False
                    else:
                        yield {"event": "token", "text": token}
            except Exception:  # noqa: BLE001
                retry_bits = []
            retry = "".join(retry_bits).strip()
            if retry and not _looks_like_planning(retry):
                answer_text = retry
            else:
                answer_text = ""
        if not answer_text:
            lead = _archive_lead_in(message, chunks, inventory_note)
            fill_bits: list[str] = []
            if lead:
                yield {"event": "token", "text": lead, "replace": True}
            try:
                for token in self.generator.iter_converse(
                    message,
                    history=[],
                    web_note=(
                        "ARCHIVE HITS (use these first, then add missing explanation):\n"
                        + (lead[:2800] if lead else "(none)")
                    ),
                ):
                    if not isinstance(token, str) or not token:
                        continue
                    fill_bits.append(token)
                    yield {"event": "token", "text": token if not lead else (
                        f"\n\n## Beyond your files\n\n{token}" if len(fill_bits) == 1 else token
                    )}
            except Exception:  # noqa: BLE001
                fill_bits = []
            fill = "".join(fill_bits).strip()
            if lead and fill:
                answer_text = f"{lead}\n\n## Beyond your files\n\n{fill}"
            else:
                answer_text = lead or fill
            if not answer_text:
                answer_text = (
                    "I searched your archive but could not compose a reply. "
                    "Try a more specific module or file name."
                )
                yield {"event": "token", "text": answer_text, "replace": True}
        if _BROKEN_LLM_RE.search(answer_text or "") or _ROUTING_MEMORY_RE.search(answer_text or ""):
            # Keep retrieval + let a normal generate-style reply through on retry via converse
            # only when the model clearly failed; do not replace with a chunk dump.
            if not _archive_hits_relevant(message, chunks):
                yield from self._iter_converse_answer(
                    message,
                    prior,
                    session_id,
                    mode,
                    status="Archive match was weak — answering from general knowledge…",
                )
                return
        sources = [_citation_payload(s) for s in chunks_to_citations(chunks)]
        if tools.sources:
            sources = sources + [_citation_payload(s) for s in tools.sources]
        retrieval = _retrieval_kind(used_archive=True, sources=sources)
        learned = self._persist_turn(
            session_id,
            message=message,
            answer=answer_text,
            mode=mode,
            sources=sources,
            retrieval=retrieval,
        )
        yield {
            "event": "answer",
            "answer": answer_text,
            "sources": sources,
            "mode": mode.value,
            "model": self.generator.ollama.chat_model,
            "retrieval": retrieval,
        }
        yield learned
        yield trace.emit_trace_complete()
        yield {"event": "done"}
