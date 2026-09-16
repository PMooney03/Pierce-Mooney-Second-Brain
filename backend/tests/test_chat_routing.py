"""Tests for Ask-mode routing and experience detection."""

from app.database.models import ChatMode, ChunkRecord
from app.services.chat_service import (
    _answer_needs_evidence_fallback,
    _archive_hits_relevant,
    _archive_lead_in,
    _is_experience_question,
    _looks_like_planning,
    _prefer_year_chunks,
    _tech_focus_terms,
    _wants_archive,
)


def test_linux_experience_is_experience_question():
    assert _is_experience_question("what is my linux experience")
    assert _tech_focus_terms("what is my linux experience") == ["Linux"]


def test_coding_languages_college_is_experience_question():
    assert _is_experience_question("tell me about the coding languages i done in college")


def test_wants_archive_for_experience_questions():
    assert _wants_archive("what is my linux experience", [], ChatMode.ASK)


def test_electric_picnic_skips_archive():
    assert not _wants_archive("tell me about electric picnic", [], ChatMode.ASK)


def test_archive_hits_irrelevant_for_electric_picnic():
    chunk = ChunkRecord(
        id="1",
        document_id=1,
        chunk_index=0,
        text="electricity flows through the transistor in the circuit lab",
        filename="Lab1 Circuits.docx",
        filepath="/x/lab.docx",
        year="Year 4",
        module="FundamentalsOFIOT",
    )
    assert not _archive_hits_relevant("tell me about electric picnic", [chunk])


def test_docker_question_still_uses_archive():
    assert _wants_archive("tell me about docker in my projects", [], ChatMode.ASK)
    assert _wants_archive("what is docker", [], ChatMode.ASK)
    assert _wants_archive("explain ansible playbooks", [], ChatMode.ASK)
    assert _tech_focus_terms("explain ansible playbooks") == ["Ansible"]


def test_long_gap_fill_without_citations_is_kept():
    chunk = ChunkRecord(
        id="1",
        document_id=1,
        chunk_index=0,
        text="docker compose lab using a bridge network",
        filename="lab.pdf",
        filepath="/x/lab.pdf",
    )
    answer = (
        "Your compose lab uses a bridge network. Beyond your files: a bridge network "
        "lets containers on the same Compose project talk by service name. "
        "That extra teaching is not a citation from the PDF."
    )
    assert not _answer_needs_evidence_fallback(answer, [chunk, chunk, chunk], question="docker compose")


def test_thin_answers_are_not_dumped():
    chunk = ChunkRecord(
        id="1",
        document_id=1,
        chunk_index=0,
        text="linux kernel lab work",
        filename="lab.pdf",
        filepath="/x/lab.pdf",
    )
    assert _answer_needs_evidence_fallback(
        'From prior chat about "linux": useful archive areas were Year 2.',
        [chunk],
        question="linux kernel labs",
    )
    assert not _answer_needs_evidence_fallback("Short.", [chunk, chunk, chunk], question="linux kernel labs")
    assert not _answer_needs_evidence_fallback(
        "Short.",
        [chunk, chunk, chunk],
        question="tell me about electric picnic",
    )


def test_prefer_year_chunks_puts_that_year_first():
    y1 = ChunkRecord(
        id="y1",
        document_id=1,
        chunk_index=0,
        text="robotics week 1",
        filename="Week 1.pdf",
        filepath="/Year1/TeamComputingRobotics/Week 1.pdf",
        year="Year 1",
        module="TeamComputingRobotics",
    )
    y4 = ChunkRecord(
        id="y4",
        document_id=2,
        chunk_index=0,
        text="systems integration lab",
        filename="Week1.pdf",
        filepath="/Year4/SystemsIntegration/Week1.pdf",
        year="Year 4",
        module="SystemsIntegration",
    )
    out = _prefer_year_chunks([y1, y4], "Year 4", limit=2)
    assert out[0].id == "y4"
    assert out[1].id == "y1"


def test_normalize_history_ignores_object_content():
    from app.llm.prompts import normalize_history

    out = normalize_history(
        [
            {"role": "user", "content": [{"role": "user", "content": "hello"}, {"x": 1}]},
            {"role": "assistant", "content": {"text": "hi there"}},
        ]
    )
    assert out[0]["content"] == "hello"
    assert out[1]["content"] == "hi there"


def test_assistant_text_flattens_content_parts():
    from app.llm.ollama_client import _assistant_text

    assert _assistant_text({"content": [{"type": "text", "text": "Docker "}, {"text": "labs"}]}) == "Docker labs"
    assert _assistant_text({"content": [{"a": 1}, {"b": 2}]}) == ""
    assert _assistant_text({"content": " "}) == " "
    from app.llm.ollama_client import _stream_delta

    delta, seen = _stream_delta("What", "What is Docker")
    assert delta == " is Docker"
    assert seen == "What is Docker"
    glued, glued_seen = _stream_delta("What", "is")
    assert glued == "is"
    assert glued_seen == "Whatis"
    punct, punct_seen = _stream_delta("Linux", "?")
    assert punct == "?"
    assert punct_seen == "Linux?"
    assert _assistant_text({"content": "", "thinking": "Ansible is used in your lab."}, allow_thinking=True) == (
        "Ansible is used in your lab."
    )


def test_planning_dump_is_detected():
    dump = (
        "We need to answer: what is typescript. We must use college evidence first. "
        "Put a space between every word. We should not mention generic freshman essay. "
        "We should not mention I couldn't find any evidence because it's a personal statement. "
        "We should not mention that. We should not mention that."
    )
    assert _looks_like_planning(dump)
    assert not _looks_like_planning(
        "TypeScript is a typed superset of JavaScript. You use it in this React frontend."
    )


def test_archive_lead_in_includes_files():
    chunk = ChunkRecord(
        id="1",
        document_id=1,
        chunk_index=0,
        text="docker compose up",
        filename="README.md",
        filepath="Projects/x/README.md",
        year=None,
        module="Projects",
    )
    text = _archive_lead_in("What is Docker?", [chunk])
    assert "README.md" in text
    assert "docker compose" in text.lower()
