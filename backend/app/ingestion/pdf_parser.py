"""PDF text extraction with PyMuPDF (page-aware) + OCR fallback for scanned pages."""

from __future__ import annotations

from pathlib import Path

import pymupdf as fitz

from app.config import get_settings
from app.database.models import ExtractedBlock, ExtractedDocument
from app.ingestion.base_parser import DocumentParser
from app.ingestion.ocr_engine import OcrError, ocr_image, pixmap_to_rgb_array
from app.logging_config import get_logger

logger = get_logger(__name__)


class PdfParseError(Exception):
    """Raised for unreadable / protected / corrupt PDFs."""


def _blocks_from_page_text(text: str, page_num: int) -> list[ExtractedBlock]:
    text = text.strip()
    if not text:
        return []
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    blocks: list[ExtractedBlock] = []
    if not paragraphs:
        joined = "\n".join(line.strip() for line in text.splitlines() if line.strip())
        if joined:
            blocks.append(
                ExtractedBlock(text=joined, page=page_num, block_type="paragraph")
            )
        return blocks
    for para in paragraphs:
        cleaned = "\n".join(line.strip() for line in para.splitlines() if line.strip())
        if cleaned:
            blocks.append(
                ExtractedBlock(text=cleaned, page=page_num, block_type="paragraph")
            )
    return blocks


def _ocr_page(page: fitz.Page, page_num: int, zoom: float) -> list[ExtractedBlock]:
    try:
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        rgb = pixmap_to_rgb_array(pix)
        text = ocr_image(rgb)
    except OcrError as exc:
        logger.warning("OCR failed on PDF page %s: %s", page_num, exc)
        return []
    except Exception as exc:  # noqa: BLE001
        logger.warning("OCR render failed on PDF page %s: %s", page_num, exc)
        return []
    if not text:
        return []
    blocks = _blocks_from_page_text(text, page_num)
    for b in blocks:
        b.block_type = "ocr"
    return blocks


class PdfParser(DocumentParser):
    extensions = {".pdf"}

    def parse(self, path: Path, relative_path: str) -> ExtractedDocument:
        settings = get_settings()
        try:
            doc = fitz.open(path)
        except Exception as exc:  # noqa: BLE001
            raise PdfParseError(f"Cannot open PDF: {exc}") from exc

        try:
            if doc.is_encrypted:
                if not doc.authenticate(""):
                    raise PdfParseError("Password-protected PDF")

            blocks: list[ExtractedBlock] = []
            ocr_pages = 0
            for page_index in range(len(doc)):
                page = doc[page_index]
                page_num = page_index + 1
                text = page.get_text("text") or ""
                page_blocks = _blocks_from_page_text(text, page_num)

                if (
                    not page_blocks
                    and settings.ocr_enabled
                    and settings.ocr_pdf_fallback
                ):
                    page_blocks = _ocr_page(page, page_num, settings.ocr_pdf_zoom)
                    if page_blocks:
                        ocr_pages += 1

                blocks.extend(page_blocks)

            if not blocks:
                raise PdfParseError("Empty PDF (no extractable text)")

            return ExtractedDocument(
                filepath=relative_path.replace("\\", "/"),
                filename=path.name,
                file_type="pdf",
                blocks=blocks,
                metadata={
                    "page_count": len(doc),
                    "ocr_pages": ocr_pages,
                },
            )
        finally:
            doc.close()
