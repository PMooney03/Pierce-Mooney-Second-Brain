"""Chunking and metadata tests."""

from __future__ import annotations

from app.database.models import ExtractedBlock, ExtractedDocument
from app.ingestion.chunker import DocumentChunker
from app.ingestion.metadata import extract_path_metadata


def test_chunker_respects_page_and_heading() -> None:
    doc = ExtractedDocument(
        filepath="Year4/Cloud_Security/Assignments/CA2.pdf",
        filename="CA2.pdf",
        file_type="pdf",
        blocks=[
            ExtractedBlock(text="Intro to cloud IAM", page=1, block_type="paragraph"),
            ExtractedBlock(text="AWS EC2 hardening steps " * 40, page=2, block_type="paragraph"),
            ExtractedBlock(text="Docker containers were used", page=3, heading="Deployment", block_type="paragraph"),
        ],
    )
    chunks = DocumentChunker(chunk_size=120, chunk_overlap=20).chunk(doc)
    assert chunks
    assert all(c.chunk_index == i for i, c in enumerate(chunks))
    assert any(c.page_start is not None for c in chunks)


def test_path_metadata_year_module_type() -> None:
    meta = extract_path_metadata("Year4/Cloud_Security/Assignments/Cloud_CA2.pdf")
    assert meta["year"] == "Year 4"
    assert meta["module"] == "Cloud Security"
    assert meta["document_type"] == "Assignment"
