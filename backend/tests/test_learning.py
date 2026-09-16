"""Tests for local learning from chat turns."""

from app.services.learning import extract_user_facts, learn_from_turn


def test_extract_user_correction():
    facts = extract_user_facts("there is no demo next thursday i have finished college months ago")
    assert any("correction" in f.lower() or "finished college" in f.lower() for f in facts)


def test_learn_does_not_save_routing_memories(tmp_path):
    from app.database.sqlite import SQLiteDatabase

    db = SQLiteDatabase(tmp_path / "t.db")
    ids = learn_from_turn(
        db,
        question="Where did I use Docker?",
        answer="In Year 4 infrastructure.",
        sources=[
            {"year": "Year 4", "module": "IntroToDevOps", "filename": "a.pdf"},
            {"year": "Year 4", "module": "CloudComputing", "filename": "b.pdf"},
        ],
    )
    assert not ids
    mems = db.list_memories()
    assert not any("useful archive areas were" in m["content"] for m in mems)


def test_learn_user_facts_still_saved(tmp_path):
    from app.database.sqlite import SQLiteDatabase

    db = SQLiteDatabase(tmp_path / "t.db")
    ids = learn_from_turn(
        db,
        question="My name is Pierce and I study computer science",
        answer="Got it.",
        sources=[],
    )
    assert ids
    mems = db.list_memories()
    assert any("Pierce" in m["content"] for m in mems)
