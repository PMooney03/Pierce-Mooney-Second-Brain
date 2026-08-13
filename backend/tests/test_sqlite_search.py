"""SQLite metadata storage and FTS keyword search."""

from __future__ import annotations

from pathlib import Path

from app.database.sqlite import SQLiteDatabase


def test_metadata_storage_and_keyword_search(tmp_path: Path) -> None:
    db = SQLiteDatabase(tmp_path / "test.db")
    doc_id = db.upsert_document(
        filepath="Year4/Cloud/notes.pdf",
        filename="notes.pdf",
        file_hash="abc",
        file_size=10,
        file_type="pdf",
        modified_at=None,
        year="Year 4",
        module="Cloud Security",
        document_type="Notes",
        chunk_count=1,
    )
    db.insert_chunks(
        [
            {
                "id": "c1",
                "document_id": doc_id,
                "chunk_index": 0,
                "text": "The organisation must comply with NIS2 directive requirements.",
                "filename": "notes.pdf",
                "filepath": "Year4/Cloud/notes.pdf",
                "page_start": 7,
                "page_end": 7,
                "heading": "Compliance",
                "year": "Year 4",
                "module": "Cloud Security",
                "document_type": "Notes",
            },
            {
                "id": "c2",
                "document_id": doc_id,
                "chunk_index": 1,
                "text": "Docker containers were used for isolation.",
                "filename": "notes.pdf",
                "filepath": "Year4/Cloud/notes.pdf",
                "page_start": 12,
                "page_end": 12,
                "heading": None,
                "year": "Year 4",
                "module": "Cloud Security",
                "document_type": "Notes",
            },
        ]
    )

    doc = db.get_document(doc_id)
    assert doc is not None
    assert doc.module == "Cloud Security"

    hits = db.keyword_search("NIS2", limit=5)
    assert hits
    assert hits[0][0].id == "c1"
    assert "NIS2" in hits[0][0].text

    docker = db.keyword_search("Docker", limit=5)
    assert docker
    assert docker[0][0].id == "c2"
