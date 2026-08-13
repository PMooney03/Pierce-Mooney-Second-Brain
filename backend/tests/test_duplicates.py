"""Incremental duplicate / update detection using SQLite records."""

from __future__ import annotations

from pathlib import Path

from app.database.models import DocumentStatus
from app.database.sqlite import SQLiteDatabase
from app.ingestion.scanner import compute_file_hash


def test_duplicate_detection_by_hash(tmp_path: Path) -> None:
    db = SQLiteDatabase(tmp_path / "dup.db")
    f = tmp_path / "doc.pdf"
    f.write_bytes(b"%PDF same")
    h = compute_file_hash(f)

    db.upsert_document(
        filepath="Year1/doc.pdf",
        filename="doc.pdf",
        file_hash=h,
        file_size=f.stat().st_size,
        file_type="pdf",
        modified_at=None,
        year="Year 1",
        module="Test",
        document_type="Document",
        status=DocumentStatus.ACTIVE.value,
        chunk_count=2,
    )
    existing = db.get_document_by_path("Year1/doc.pdf")
    assert existing is not None
    assert existing.file_hash == compute_file_hash(f)

    # Change content → hash differs → should be treated as update by ingestion logic
    f.write_bytes(b"%PDF changed")
    assert existing.file_hash != compute_file_hash(f)
