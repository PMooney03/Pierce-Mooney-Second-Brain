"""Tests for source-code extraction."""

from __future__ import annotations

from pathlib import Path

from app.ingestion.code_parser import CodeParser
from app.ingestion.metadata import extract_path_metadata


def test_python_code_extraction(tmp_path: Path) -> None:
    path = tmp_path / "demo.py"
    path.write_text(
        "def greet(name):\n    return f'hi {name}'\n\nclass Bot:\n    def run(self):\n        pass\n",
        encoding="utf-8",
    )
    extracted = CodeParser().parse(path, "Projects/Demo/demo.py")
    assert extracted.file_type == "py"
    assert any("greet" in b.text for b in extracted.blocks)


def test_projects_path_metadata() -> None:
    meta = extract_path_metadata("Projects/NetworkOpsDashboard/src/app.ts")
    assert meta["module"] == "NetworkOpsDashboard"
    assert meta["document_type"] == "Project"
