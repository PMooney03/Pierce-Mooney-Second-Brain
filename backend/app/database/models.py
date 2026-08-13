"""Domain dataclasses and API-oriented types for the second brain."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class DocumentStatus(str, Enum):
    ACTIVE = "active"
    UNAVAILABLE = "unavailable"
    ERROR = "error"


class ChatMode(str, Enum):
    ASK = "ask"
    RECALL = "recall"
    SEARCH = "search"
    EXPLAIN = "explain"
    CONNECT = "connect"
    REVISION = "revision"
    INTERVIEW = "interview"
    PROJECT = "project"


@dataclass
class ExtractedBlock:
    """A structural unit of text extracted from a document."""

    text: str
    page: int | None = None
    heading: str | None = None
    block_type: str = "paragraph"  # paragraph | heading | table | list


@dataclass
class ExtractedDocument:
    """Full extraction result for one file."""

    filepath: str
    filename: str
    file_type: str
    blocks: list[ExtractedBlock] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChunkData:
    """A chunk ready for storage and embedding."""

    text: str
    chunk_index: int
    page_start: int | None = None
    page_end: int | None = None
    heading: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentRecord:
    id: int
    filepath: str
    filename: str
    file_hash: str
    file_size: int
    file_type: str
    modified_at: str | None
    ingested_at: str | None
    status: str
    year: str | None = None
    module: str | None = None
    document_type: str | None = None
    chunk_count: int = 0
    error_message: str | None = None


@dataclass
class ChunkRecord:
    id: str
    document_id: int
    chunk_index: int
    text: str
    filename: str
    filepath: str
    page_start: int | None = None
    page_end: int | None = None
    heading: str | None = None
    year: str | None = None
    module: str | None = None
    document_type: str | None = None
    score: float | None = None
    score_source: str | None = None  # semantic | keyword | hybrid


@dataclass
class SearchHit:
    chunk: ChunkRecord
    semantic_score: float | None = None
    keyword_score: float | None = None
    hybrid_score: float = 0.0


@dataclass
class SourceCitation:
    document_id: int
    chunk_id: str
    filename: str
    filepath: str
    page: int | None
    heading: str | None
    text_preview: str
    year: str | None = None
    module: str | None = None
    score: float | None = None
    match_type: str | None = None  # keyword | semantic | hybrid


@dataclass
class ChatResult:
    answer: str
    sources: list[SourceCitation]
    mode: str
    model: str


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
