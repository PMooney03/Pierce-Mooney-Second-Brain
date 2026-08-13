"""Hybrid result merging / RRF tests."""

from __future__ import annotations

from app.database.models import ChunkRecord
from app.retrieval.reranker import lexical_boost, reciprocal_rank_fusion


def _chunk(cid: str, text: str) -> ChunkRecord:
    return ChunkRecord(
        id=cid,
        document_id=1,
        chunk_index=0,
        text=text,
        filename="a.pdf",
        filepath="a.pdf",
    )


def test_rrf_merges_and_dedupes() -> None:
    semantic = [
        (_chunk("a", "alpha"), 0.9),
        (_chunk("b", "beta"), 0.8),
        (_chunk("c", "gamma"), 0.7),
    ]
    keyword = [
        (_chunk("c", "gamma"), 0.95),
        (_chunk("d", "delta"), 0.9),
        (_chunk("a", "alpha"), 0.5),
    ]
    fused = reciprocal_rank_fusion([semantic, keyword], labels=["semantic", "keyword"])
    ids = [cid for cid, _, _ in fused]
    assert len(ids) == len(set(ids))
    assert set(ids) == {"a", "b", "c", "d"}
    # c appears high in both lists → should rank near top
    assert ids[0] in {"a", "c"}


def test_lexical_boost_prefers_term_hits() -> None:
    fused = [
        ("a", 0.1, {"chunk": _chunk("a", "no match here")}),
        ("b", 0.1, {"chunk": _chunk("b", "We used Docker extensively")}),
    ]
    boosted = lexical_boost(fused, ["Docker"])
    assert boosted[0][0] == "b"
