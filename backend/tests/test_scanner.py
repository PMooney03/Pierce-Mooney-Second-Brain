"""Tests for hashing, scanning, and duplicate detection."""

from __future__ import annotations

from pathlib import Path

from app.ingestion.scanner import compute_file_hash, scan_documents


def test_compute_file_hash_stable(tmp_path: Path) -> None:
    f = tmp_path / "a.txt"
    f.write_bytes(b"hello college")
    h1 = compute_file_hash(f)
    h2 = compute_file_hash(f)
    assert h1 == h2
    assert len(h1) == 64


def test_hash_changes_when_content_changes(tmp_path: Path) -> None:
    f = tmp_path / "a.txt"
    f.write_bytes(b"v1")
    h1 = compute_file_hash(f)
    f.write_bytes(b"v2")
    h2 = compute_file_hash(f)
    assert h1 != h2


def test_scan_finds_pdf_docx_and_code(tmp_path: Path) -> None:
    (tmp_path / "Year1" / "Mod").mkdir(parents=True)
    (tmp_path / "Year1" / "Mod" / "notes.pdf").write_bytes(b"%PDF-1.4")
    (tmp_path / "Year1" / "Mod" / "essay.docx").write_bytes(b"PK")
    (tmp_path / "Year1" / "Mod" / "slides.pptx").write_bytes(b"skip")
    (tmp_path / "Projects" / "Demo").mkdir(parents=True)
    (tmp_path / "Projects" / "Demo" / "main.py").write_text("print('hi')\n", encoding="utf-8")
    found = scan_documents(tmp_path)
    names = {f.filename for f in found}
    assert "notes.pdf" in names
    assert "essay.docx" in names
    assert "main.py" in names
    assert "slides.pptx" not in names
