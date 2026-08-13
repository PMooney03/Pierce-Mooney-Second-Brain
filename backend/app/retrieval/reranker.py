"""Ranking helpers: RRF fusion and light lexical boosts."""

from __future__ import annotations

from typing import Any

from app.database.models import ChunkRecord


def reciprocal_rank_fusion(
    ranked_lists: list[list[tuple[ChunkRecord, float]]],
    *,
    labels: list[str],
    k: int = 60,
) -> list[tuple[str, float, dict[str, Any]]]:
    """
    Merge ranked lists with Reciprocal Rank Fusion.

    Returns list of (chunk_id, rrf_score, meta) sorted descending.
    """
    scores: dict[str, float] = {}
    meta: dict[str, dict[str, Any]] = {}

    for label, ranked in zip(labels, ranked_lists):
        for rank, (chunk, raw_score) in enumerate(ranked, start=1):
            cid = chunk.id
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank)
            entry = meta.setdefault(cid, {"chunk": chunk})
            entry[f"{label}_score"] = raw_score
            entry["chunk"] = chunk

    fused = [(cid, score, meta[cid]) for cid, score in scores.items()]
    fused.sort(key=lambda x: x[1], reverse=True)
    return fused


def lexical_boost(
    fused: list[tuple[str, float, dict[str, Any]]],
    terms: list[str],
    boost: float = 0.05,
) -> list[tuple[str, float, dict[str, Any]]]:
    """Slightly boost chunks that contain query terms (case-insensitive)."""
    if not terms:
        return fused

    lowered_terms = [t.lower() for t in terms]
    boosted: list[tuple[str, float, dict[str, Any]]] = []
    for cid, score, meta in fused:
        chunk: ChunkRecord = meta["chunk"]
        text = (chunk.text or "").lower()
        hits = sum(1 for t in lowered_terms if t in text)
        new_score = score + boost * hits
        boosted.append((cid, new_score, meta))
    boosted.sort(key=lambda x: x[1], reverse=True)
    return boosted
