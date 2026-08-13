"""PDF text extraction with PyMuPDF (page-aware)."""

from __future__ import annotations

from pathlib import Path

import pymupdf as fitz

from app.database.models import ExtractedBlock, ExtractedDocument
from app.ingestion.base_parser import DocumentParser
from app.logging_config import get_logger

logger = get_logger(__name__)


class PdfParseError(Exception):
    """Raised for unreadable / protected / corrupt PDFs."""


class PdfParser(DocumentParser):
    extensions = {".pdf"}

    def parse(self, path: Path, relative_path: str) -> ExtractedDocument:
        try:
            doc = fitz.open(path)
        except Exception as exc:  # noqa: BLE001
            raise PdfParseError(f"Cannot open PDF: {exc}") from exc

        try:
            if doc.is_encrypted:
                # Try empty password; fail clearly otherwise
                if not doc.authenticate(""):
                    raise PdfParseError("Password-protected PDF")

            blocks: list[ExtractedBlock] = []
            for page_index in range(len(doc)):
                page = doc[page_index]
                page_num = page_index + 1
                text = page.get_text("text") or ""
                text = text.strip()
                if not text:
                    continue
                # Split into paragraphs while keeping page number
                paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
                if not paragraphs:
                    # Fall back to line-joined block
                    joined = "\n".join(
                        line.strip() for line in text.splitlines() if line.strip()
                    )
                    if joined:
                        blocks.append(
                            ExtractedBlock(text=joined, page=page_num, block_type="paragraph")
                        )
                else:
                    for para in paragraphs:
                        cleaned = "\n".join(
                            line.strip() for line in para.splitlines() if line.strip()
                        )
                        if cleaned:
                            blocks.append(
                                ExtractedBlock(
                                    text=cleaned, page=page_num, block_type="paragraph"
                                )
                            )

            if not blocks:
                raise PdfParseError("Empty PDF (no extractable text)")

            return ExtractedDocument(
                filepath=relative_path.replace("\\", "/"),
                filename=path.name,
                file_type="pdf",
                blocks=blocks,
                metadata={"page_count": len(doc)},
            )
        finally:
            doc.close()
