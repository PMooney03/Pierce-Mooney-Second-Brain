from pathlib import Path

from ai_assistant.knowledge import project_doc_paths, search_documentation


def test_project_doc_paths_includes_readme():
    root = Path(__file__).resolve().parent.parent
    paths = project_doc_paths(root)
    names = {p.name for p in paths}
    assert "README.md" in names
    assert any("SETUP" in str(p) for p in paths)


def test_search_finds_dc1_content():
    root = Path(__file__).resolve().parent.parent
    chunks = search_documentation(root, "What does dc-1 do domain controller", top_k=3)
    assert chunks
    combined = " ".join(chunk.text.lower() for chunk in chunks)
    assert "dc" in combined or "domain" in combined
