"""Unit tests for search_trace helpers."""

from app.database.models import ChatMode, ChunkRecord, SearchHit
from app.services import search_trace as trace


def test_topic_label_prefers_technical_token():
    assert trace.topic_label("Where did I use Docker in college?") == "Docker"


def test_topic_label_empty():
    assert trace.topic_label("what about my") is None


def test_match_type_keyword_dominant():
    chunk = ChunkRecord(
        id="c1",
        document_id=1,
        chunk_index=0,
        text="docker compose",
        filename="a.pdf",
        filepath="Year4/a.pdf",
        year="Year 4",
        module="Infra",
    )
    hit = SearchHit(chunk=chunk, semantic_score=0.1, keyword_score=0.5, hybrid_score=0.4)
    assert trace.match_type_for_hit(hit) == "keyword"


def test_scope_label_projects():
    assert (
        trace.scope_label_for_chunk(
            year=None, filepath="Projects/SME/report.pdf", module=None
        )
        == "Projects"
    )


def test_select_scopes_year_focus_without_db():
    scopes = trace.select_scopes(None, year_focus="Year 1")
    assert scopes == [{"name": "Year 1", "document_count": None}]


def test_iter_pre_search_emits_trace_started():
    events = list(
        trace.iter_pre_search_trace(
            None,
            query="Find NIS2",
            mode=ChatMode.ASK,
            year_focus=None,
            project_focus=False,
            expand_modules=False,
        )
    )
    kinds = [e["event"] for e in events]
    assert "trace_started" in kinds
    assert "scope" in kinds
    assert "phase" in kinds
    assert events[0]["topic"] == "NIS2"
