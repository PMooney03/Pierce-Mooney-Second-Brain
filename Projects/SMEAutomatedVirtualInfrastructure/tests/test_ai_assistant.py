from unittest.mock import patch

from ai_assistant.analysis import (
    analyse_setup_log_text,
    check_api_key_configured,
    fetch_host_provision_log,
)
from ai_assistant.common import (
    analysis_is_usable,
    coerce_plain_text_response,
    extract_log_excerpt,
    heuristic_log_analysis,
    normalise_analysis,
    parse_model_json,
    uses_local_llm_api,
)


def test_extract_log_excerpt_prioritises_errors_and_tail():
    log_text = "\n".join(
        [f"info line {index}" for index in range(20)]
        + ["fatal: provisioning failed on log-1"]
        + [f"tail line {index}" for index in range(20, 60)]
    )

    excerpt = extract_log_excerpt(log_text, max_lines=15, context_lines=1, tail_lines=3)

    assert "fatal: provisioning failed on log-1" in excerpt
    assert "tail line 59" in excerpt


def test_parse_model_json_accepts_json_fenced_output():
    raw = """```json
{"summary":"ok","likely_cause":"bad config","suggested_fix":"fix config","commands_to_try":["python cli.py deploy"],"severity":"high","confidence":"medium","safety_notes":"review first"}
```"""

    parsed = parse_model_json(raw)

    assert parsed["severity"] == "high"
    assert parsed["commands_to_try"] == ["python cli.py deploy"]


def test_normalise_analysis_converts_string_commands_to_list():
    normalised = normalise_analysis(
        {
            "summary": "Summary",
            "likely_cause": "Cause",
            "suggested_fix": "Fix",
            "commands_to_try": "python cli.py deploy\npython cli.py debug --host-debug log-1",
            "severity": "HIGH",
            "confidence": "high",
        }
    )

    assert normalised["severity"] == "high"
    assert normalised["commands_to_try"] == [
        "python cli.py deploy",
        "python cli.py debug --host-debug log-1",
    ]


def test_check_api_key_configured_reports_missing_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert check_api_key_configured() is not None


def test_check_api_key_configured_accepts_set_key(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    assert check_api_key_configured() is None


def test_analyse_setup_log_text_uses_openai_response(monkeypatch, capsys):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def fake_call(_prompt, *, model=None):
        return {
            "summary": "DNS not ready",
            "likely_cause": "dc-1 not reachable",
            "suggested_fix": "Wait for dc-1 then reprovision web-1",
            "commands_to_try": ["python cli.py debug --host-debug dc-1"],
            "severity": "high",
            "confidence": "medium",
            "safety_notes": "Review commands before running.",
        }

    with patch("ai_assistant.analysis.call_openai_json", side_effect=fake_call):
        exit_code = analyse_setup_log_text("sample.log", "fatal: provisioning failed")

    captured = capsys.readouterr().out
    assert exit_code == 0
    assert "DNS not ready" in captured
    assert "python cli.py debug --host-debug dc-1" in captured


def test_analysis_is_usable_rejects_empty_summary():
    assert analysis_is_usable({}) is False
    assert analysis_is_usable({"summary": "DNS failed on dc-1"}) is True


def test_heuristic_log_analysis_detects_dc2_unreachable():
    data = heuristic_log_analysis(
        "Jun 4 dc-1 samba: Failed to connect host 192.168.56.11 - UNREACHABLE"
    )
    assert "dc-2" in data["summary"] or "192.168.56.11" in data["summary"]
    assert data["commands_to_try"]


def test_coerce_plain_text_response_wraps_narrative():
    data = coerce_plain_text_response("DNS failed on dc-1. Check bind9.")
    assert "DNS failed" in data["summary"]
    assert data["severity"] == "unknown"


def test_uses_local_llm_api_detects_ollama(monkeypatch):
    monkeypatch.setenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
    assert uses_local_llm_api() is True
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    assert uses_local_llm_api() is False


def test_fetch_host_provision_log_returns_ssh_output(tmp_path, monkeypatch):
    class FakeResult:
        returncode = 0
        stdout = "LOG_SOURCE:/var/log/vagrant-provision.log\nfatal: provisioning failed\n"
        stderr = ""

    monkeypatch.setattr(
        "ai_assistant.analysis.subprocess.run",
        lambda *args, **kwargs: FakeResult(),
    )

    exit_code, text, source = fetch_host_provision_log("dc-1", vagrant_cwd=tmp_path)
    assert exit_code == 0
    assert "fatal: provisioning failed" in text
    assert source == "/var/log/vagrant-provision.log"
