"""Local OCR via RapidOCR (ONNX Runtime) — no cloud, no system Tesseract."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import numpy as np

from app.logging_config import get_logger

logger = get_logger(__name__)


class OcrError(Exception):
    """Raised when OCR cannot run or yields no usable text."""


def _lines_from_result(result: Any) -> list[str]:
    """Normalize RapidOCR / legacy tuple outputs to text lines."""
    if result is None:
        return []

    txts = getattr(result, "txts", None)
    if txts:
        return [str(t).strip() for t in txts if str(t).strip()]

    # Legacy rapidocr-onnxruntime: (boxes, texts, scores) or list of rows
    if isinstance(result, tuple) and len(result) >= 2:
        texts = result[1]
        if texts is None:
            return []
        if isinstance(texts, (list, tuple)):
            return [str(t).strip() for t in texts if str(t).strip()]

    if isinstance(result, list):
        lines: list[str] = []
        for row in result:
            if isinstance(row, (list, tuple)) and len(row) >= 2:
                text = str(row[1]).strip()
                if text:
                    lines.append(text)
            elif isinstance(row, str) and row.strip():
                lines.append(row.strip())
        return lines

    return []


@lru_cache(maxsize=1)
def get_ocr_engine() -> Any:
    """Lazy-load RapidOCR once per process (models stay in memory)."""
    try:
        from rapidocr import RapidOCR
    except ImportError as exc:
        raise OcrError(
            "OCR package missing. Install with: pip install rapidocr onnxruntime"
        ) from exc

    logger.info("Loading RapidOCR engine (first use may take a few seconds)")
    return RapidOCR()


def ocr_image(image: Any) -> str:
    """
    Run OCR on a file path, PNG/JPEG bytes, or HxWxC numpy array (RGB/BGR).

    Returns joined text lines (top-to-bottom order from the engine).
    """
    engine = get_ocr_engine()
    try:
        result = engine(image)
    except Exception as exc:  # noqa: BLE001
        raise OcrError(f"OCR failed: {exc}") from exc

    lines = _lines_from_result(result)
    return "\n".join(lines).strip()


def pixmap_to_rgb_array(pix: Any) -> np.ndarray:
    """Convert a PyMuPDF Pixmap to an RGB uint8 array for RapidOCR."""
    samples = np.frombuffer(pix.samples, dtype=np.uint8)
    if pix.n == 1:
        arr = samples.reshape(pix.h, pix.w)
        return np.stack([arr, arr, arr], axis=-1)
    if pix.n == 3:
        return samples.reshape(pix.h, pix.w, 3)
    if pix.n == 4:
        rgba = samples.reshape(pix.h, pix.w, 4)
        return rgba[:, :, :3].copy()
    raise OcrError(f"Unsupported pixmap channel count: {pix.n}")
