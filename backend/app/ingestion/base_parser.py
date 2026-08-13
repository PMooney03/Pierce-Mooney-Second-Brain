"""Base parser interface for document extractors."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from app.database.models import ExtractedDocument


class DocumentParser(ABC):
    """Pluggable parser for a file type."""

    extensions: set[str] = set()

    @abstractmethod
    def parse(self, path: Path, relative_path: str) -> ExtractedDocument:
        """Extract structured text from a file. Never modifies the file."""


class ParserRegistry:
    """Maps extensions to parsers."""

    def __init__(self) -> None:
        self._parsers: dict[str, DocumentParser] = {}

    def register(self, parser: DocumentParser) -> None:
        for ext in parser.extensions:
            self._parsers[ext.lower()] = parser

    def get(self, extension: str) -> DocumentParser | None:
        return self._parsers.get(extension.lower())

    def supported(self) -> set[str]:
        return set(self._parsers.keys())
