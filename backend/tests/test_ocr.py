"""OCR helpers and image / scanned-PDF extraction tests."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pymupdf as fitz
import pytest
from PIL import Image, ImageDraw

from app.ingestion.image_parser import ImageParseError, ImageParser
from app.ingestion.ocr_engine import _lines_from_result
from app.ingestion.pdf_parser import PdfParser
from app.ingestion.scanner import scan_documents


def test_lines_from_rapidocr_output() -> None:
    result = SimpleNamespace(txts=("Hello", "World", "  "))
    assert _lines_from_result(result) == ["Hello", "World"]


def test_lines_from_legacy_list() -> None:
    rows = [[[0, 0], "Alpha", 0.9], [[1, 1], "Beta", 0.8]]
    assert _lines_from_result(rows) == ["Alpha", "Beta"]


def test_image_ocr_extracts_text(tmp_path: Path) -> None:
    path = tmp_path / "slide.png"
    img = Image.new("RGB", (480, 120), "white")
    draw = ImageDraw.Draw(img)
    draw.text((20, 40), "NIS2 Directive Docker Lab", fill="black")
    img.save(path)

    extracted = ImageParser().parse(path, "Year3/Sec/slide.png")
    assert extracted.file_type == "png"
    joined = " ".join(b.text for b in extracted.blocks)
    assert "NIS2" in joined
    assert extracted.metadata.get("ocr") is True


def test_image_too_small_rejected(tmp_path: Path) -> None:
    path = tmp_path / "icon.png"
    Image.new("RGB", (32, 32), "white").save(path)
    with pytest.raises(ImageParseError, match="too small"):
        ImageParser().parse(path, "Projects/Demo/icon.png")


def test_pdf_ocr_fallback_on_blank_text_page(tmp_path: Path) -> None:
    """Image-only PDF page should OCR when native text is empty."""
    pdf = tmp_path / "scan.pdf"
    # Build a PNG then embed it as a full-page image in a PDF
    png = tmp_path / "page.png"
    img = Image.new("RGB", (500, 200), "white")
    draw = ImageDraw.Draw(img)
    draw.text((30, 80), "Group Policy Active Directory", fill="black")
    img.save(png)

    doc = fitz.open()
    page = doc.new_page(width=500, height=200)
    page.insert_image(page.rect, filename=str(png))
    doc.save(pdf)
    doc.close()

    # Confirm native text is empty / near-empty
    check = fitz.open(pdf)
    native = (check[0].get_text("text") or "").strip()
    check.close()
    assert native == ""

    extracted = PdfParser().parse(pdf, "Year2/Sec/scan.pdf")
    joined = " ".join(b.text for b in extracted.blocks)
    assert "Group Policy" in joined or "Active Directory" in joined
    assert extracted.metadata.get("ocr_pages", 0) >= 1


def test_scan_finds_images_and_skips_images_dir(tmp_path: Path) -> None:
    (tmp_path / "Year1" / "Mod").mkdir(parents=True)
    (tmp_path / "Year1" / "Mod" / "board.png").write_bytes(b"\x89PNG\r\n")
    (tmp_path / "Images").mkdir()
    (tmp_path / "Images" / "readme.png").write_bytes(b"\x89PNG\r\n")
    found = scan_documents(tmp_path)
    names = {f.filename for f in found}
    assert "board.png" in names
    assert "readme.png" not in names
