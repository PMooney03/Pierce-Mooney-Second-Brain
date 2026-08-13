"""Simple documentation retrieval for the SME support agent (no embeddings)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DocChunk:
    path: str
    start_line: int
    text: str
    score: float = 0.0


def project_doc_paths(project_root: Path) -> list[Path]:
    """Markdown and text files used as the knowledge base."""
    candidates: list[Path] = []
    for pattern in (
        "README.md",
        "QUICK_START.md",
        "PROJECT_EXPLANATION.md",
        "USER_ACCESS.md",
        "docs/**/*.md",
        "ai_assistant/README.md",
    ):
        candidates.extend(project_root.glob(pattern))
    seen: set[Path] = set()
    unique: list[Path] = []
    for path in sorted(candidates):
        resolved = path.resolve()
        if resolved in seen or not path.is_file():
            continue
        seen.add(resolved)
        unique.append(path)
    return unique


def _chunk_file(path: Path) -> list[DocChunk]:
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []

    chunks: list[DocChunk] = []
    buffer: list[str] = []
    buffer_start = 1

    def flush(end_line: int) -> None:
        nonlocal buffer, buffer_start
        text = "\n".join(buffer).strip()
        if len(text) >= 80:
            chunks.append(
                DocChunk(
                    path=str(path),
                    start_line=buffer_start,
                    text=text,
                )
            )
        buffer = []
        buffer_start = end_line + 1

    for index, line in enumerate(lines, start=1):
        if line.startswith("#") and buffer:
            flush(index - 1)
        buffer.append(line)
        if len(buffer) >= 40:
            flush(index)
            buffer_start = index + 1

    if buffer:
        flush(len(lines))

    return chunks


def _query_terms(query: str) -> list[str]:
    terms = re.findall(r"[a-z0-9]+", query.lower())
    stop = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "should",
        "could", "may", "might", "must", "shall", "can", "need", "dare",
        "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
        "from", "as", "into", "through", "during", "before", "after", "above",
        "below", "between", "out", "off", "over", "under", "again", "further",
        "then", "once", "here", "there", "when", "where", "why", "how", "all",
        "each", "few", "more", "most", "other", "some", "such", "no", "nor",
        "not", "only", "own", "same", "so", "than", "too", "very", "just",
        "and", "but", "if", "or", "because", "until", "while", "what", "which",
        "who", "whom", "this", "that", "these", "those", "am", "i", "me", "my",
    }
    return [term for term in terms if len(term) > 2 and term not in stop]


def score_chunk(chunk: DocChunk, terms: list[str], query: str) -> float:
    if not terms:
        return 0.0
    lowered = chunk.text.lower()
    score = sum(lowered.count(term) for term in terms)
    query_lower = query.lower().strip()
    if len(query_lower) > 8 and query_lower in lowered:
        score += 10.0
    return float(score)


def search_documentation(
    project_root: Path,
    query: str,
    *,
    top_k: int = 5,
    min_score: float = 1.0,
) -> list[DocChunk]:
    """Return the top documentation chunks for a user question."""
    terms = _query_terms(query)
    all_chunks: list[DocChunk] = []
    for path in project_doc_paths(project_root):
        all_chunks.extend(_chunk_file(path))

    scored: list[DocChunk] = []
    for chunk in all_chunks:
        value = score_chunk(chunk, terms, query)
        if value >= min_score:
            scored.append(
                DocChunk(
                    path=chunk.path,
                    start_line=chunk.start_line,
                    text=chunk.text,
                    score=value,
                )
            )

    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:top_k]


def _display_path(path_str: str, project_root: Path | None) -> str:
    path = Path(path_str)
    if project_root is not None:
        try:
            return str(path.relative_to(project_root))
        except ValueError:
            pass
    return path.name


def format_sources(chunks: list[DocChunk], *, project_root: Path | None = None) -> str:
    if not chunks:
        return "No matching documentation snippets found."
    lines = ["Sources:"]
    for index, chunk in enumerate(chunks, start=1):
        rel = _display_path(chunk.path, project_root)
        lines.append(
            f"  [{index}] {rel} (line ~{chunk.start_line}, score {chunk.score:.0f})"
        )
    return "\n".join(lines)


def build_context_block(chunks: list[DocChunk], *, project_root: Path | None = None) -> str:
    if not chunks:
        return "(No documentation snippets matched the question.)"
    parts: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        rel = _display_path(chunk.path, project_root)
        parts.append(
            f"--- Snippet {index}: {rel} (line ~{chunk.start_line}) ---\n{chunk.text}"
        )
    return "\n\n".join(parts)
