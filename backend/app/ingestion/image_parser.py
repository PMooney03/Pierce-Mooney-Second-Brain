"""Image OCR extraction (PNG / JPEG / WebP / GIF / BMP)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from app.config import get_settings
from app.database.models import ExtractedBlock, ExtractedDocument
from app.ingestion.base_parser import DocumentParser
from app.ingestion.ocr_engine import OcrError, ocr_image
from app.logging_config import get_logger

logger = get_logger(__name__)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


class ImageParseError(Exception):
    """Raised when an image cannot be OCR'd into usable text."""


class ImageParser(DocumentParser):
    extensions = IMAGE_EXTENSIONS

    def parse(self, path: Path, relative_path: str) -> ExtractedDocument:
        settings = get_settings()
        if not settings.ocr_enabled:
            raise ImageParseError("OCR is disabled (OCR_ENABLED=false)")

        max_bytes = int(settings.ocr_max_file_mb * 1024 * 1024)
        size = path.stat().st_size
        if size > max_bytes:
            raise ImageParseError(
                f"Image too large for OCR ({size / (1024 * 1024):.1f} MB > "
                f"{settings.ocr_max_file_mb} MB)"
            )

        try:
            with Image.open(path) as img:
                width, height = img.size
                if min(width, height) < settings.ocr_min_image_side:
                    raise ImageParseError(
                        f"Image too small for OCR ({width}x{height}; "
                        f"min side {settings.ocr_min_image_side})"
                    )
                # Flatten animated GIF / palette / RGBA to RGB for empty-path retry
                rgb = img.convert("RGB")
        except ImageParseError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ImageParseError(f"Cannot open image: {exc}") from exc

        try:
            text = ocr_image(str(path))
        except OcrError as exc:
            raise ImageParseError(str(exc)) from exc

        if not text:
            try:
                import numpy as np

                text = ocr_image(np.asarray(rgb))
            except OcrError as exc:
                raise ImageParseError(str(exc)) from exc

        if not text or len(text) < 3:
            raise ImageParseError("No text detected in image")

        lines = [line.strip() for line in text.splitlines() if line.strip()]
        joined = "\n".join(lines)
        blocks = [ExtractedBlock(text=joined, page=1, block_type="paragraph")]

        logger.info("OCR extracted %s chars from %s", len(joined), relative_path)
        return ExtractedDocument(
            filepath=relative_path.replace("\\", "/"),
            filename=path.name,
            file_type=path.suffix.lower().lstrip(".") or "image",
            blocks=blocks,
            metadata={
                "ocr": True,
                "width": width,
                "height": height,
            },
        )
