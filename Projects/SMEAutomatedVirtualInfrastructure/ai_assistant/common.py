"""Shared helpers for optional AI-assisted troubleshooting tools."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib import error, request

PACKAGE_ROOT = Path(__file__).resolve().parent
PROMPTS_DIR = PACKAGE_ROOT / "prompts"
EXAMPLES_DIR = PACKAGE_ROOT / "examples"

DEFAULT_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
DEFAULT_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
DEFAULT_TIMEOUT_SECONDS = 60
LOCAL_LLM_TIMEOUT_SECONDS = 180
JSON_SCHEMA_HINT = (
    '{"summary":"...","likely_cause":"...","suggested_fix":"...",'
    '"commands_to_try":["cmd1"],"severity":"low|medium|high|critical",'
    '"confidence":"low|medium|high","safety_notes":"..."}'
)
SAFETY_NOTE = (
    "Advisory only. Review every suggestion before running commands. "
    "This assistant never executes fixes automatically."
)

LOG_KEYWORDS = (
    "error",
    "failed",
    "fatal",
    "exception",
    "traceback",
    "timed out",
    "timeout",
    "permission denied",
    "unreachable",
    "refused",
    "not found",
    "cannot",
)


class AIAnalysisError(RuntimeError):
    """Raised when the AI assistant cannot complete an analysis."""


def load_prompt_file(filename: str) -> str:
    path = PROMPTS_DIR / filename
    return path.read_text(encoding="utf-8")


def read_text_file(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8", errors="replace")


def read_json_file(path: str | Path) -> Any:
    return json.loads(read_text_file(path))


def extract_log_excerpt(
    text: str,
    *,
    max_lines: int = 200,
    context_lines: int = 4,
    tail_lines: int = 40,
) -> str:
    """Return the most relevant log lines with light context and a short tail."""
    lines = text.splitlines()
    if not lines:
        return ""

    if len(lines) <= max_lines:
        return "\n".join(lines)

    selected_indexes: set[int] = set()
    for index, line in enumerate(lines):
        lowered = line.lower()
        if any(keyword in lowered for keyword in LOG_KEYWORDS):
            start = max(0, index - context_lines)
            end = min(len(lines), index + context_lines + 1)
            selected_indexes.update(range(start, end))

    tail_start = max(0, len(lines) - tail_lines)
    selected_indexes.update(range(tail_start, len(lines)))

    if not selected_indexes:
        return "\n".join(lines[-max_lines:])

    ordered = [lines[index] for index in sorted(selected_indexes)]
    if len(ordered) > max_lines:
        ordered = ordered[-max_lines:]
    return "\n".join(ordered)


def prepare_setup_log_prompt(template: str, source_name: str, excerpt: str) -> str:
    return (
        template.replace("{{SOURCE_NAME}}", source_name).replace("{{LOG_EXCERPT}}", excerpt)
    )


def prepare_alert_prompt(template: str, source_name: str, alert_json: str) -> str:
    return (
        template.replace("{{SOURCE_NAME}}", source_name).replace("{{ALERT_JSON}}", alert_json)
    )


def _api_base_url() -> str:
    return os.environ.get("OPENAI_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def uses_local_llm_api() -> bool:
    """True when the configured API base URL points at a local server (e.g. Ollama)."""
    base = _api_base_url().lower()
    return (
        "localhost" in base
        or "127.0.0.1" in base
        or ":11434" in base
    )


def analysis_is_usable(data: dict[str, Any]) -> bool:
    """True when the model returned at least a non-empty summary."""
    normalised = normalise_analysis(data)
    summary = normalised["summary"]
    return bool(summary) and summary not in ("No summary returned.",)


def heuristic_log_analysis(log_text: str) -> dict[str, Any]:
    """Rule-based fallback when a local model returns empty or useless JSON."""
    lines = [line for line in log_text.splitlines() if line.strip()]
    tail = "\n".join(lines[-12:]) if lines else log_text[:500]

    summary_parts: list[str] = []
    if "192.168.56.11" in log_text and (
        "Failed to connect" in log_text or "UNREACHABLE" in log_text
    ):
        summary_parts.append(
            "dc-1 cannot reach dc-2 at 192.168.56.11 (Samba/LDAP replication partner)."
        )
    if any(word in log_text.lower() for word in ("fatal", "failed", "error", "timeout")):
        summary_parts.append("The log excerpt contains error or failure lines.")

    summary = (
        " ".join(summary_parts)
        if summary_parts
        else "Local model returned no usable analysis. Recent log lines:"
    )
    if not summary_parts and tail:
        summary = f"{summary}\n{tail[:700]}"

    return {
        "summary": summary,
        "likely_cause": (
            "If only dc-1 is running, dc-2 is likely still down — Samba errors to "
            "192.168.56.11 are expected until you run: vagrant up dc-2"
        ),
        "suggested_fix": (
            "Check VM status, start missing hosts, then re-run analysis. "
            "Optional: vagrant provision dc-1 for a dedicated provision log."
        ),
        "commands_to_try": [
            "cd vagrant && vagrant status",
            "cd vagrant && vagrant up dc-2",
            "python cli.py status --provisioning",
        ],
        "severity": "low",
        "confidence": "medium",
        "safety_notes": (
            "Advisory only. This report was generated from log patterns because the "
            "local LLM returned empty JSON. Verify against your actual logs."
        ),
    }


def coerce_plain_text_response(raw_content: str) -> dict[str, Any]:
    """Build a best-effort analysis dict when a local model ignores JSON instructions."""
    text = raw_content.strip()
    if len(text) > 900:
        text = text[:900] + "..."

    dc2_hint = ""
    if "192.168.56.11" in raw_content or "dc-2" in raw_content.lower():
        dc2_hint = (
            " Your syslog shows connection failures to 192.168.56.11 (dc-2). "
            "If only dc-1 is running, start dc-2 with: cd vagrant && vagrant up dc-2"
        )

    return {
        "summary": text or "The model returned an empty response.",
        "likely_cause": (
            "Local model did not return strict JSON; summary may include generic advice. "
            f"For dc-1-only labs, check whether dc-2 is up before changing Samba.{dc2_hint}"
        ),
        "suggested_fix": (
            "If only dc-1 is running: vagrant up dc-2 from the vagrant folder, then re-check. "
            "For a dedicated provision log: vagrant provision dc-1. "
            "Ignore Windows/smbclient steps unless your log explicitly mentions them."
        ),
        "commands_to_try": [
            "cd vagrant && vagrant status",
            "cd vagrant && vagrant up dc-2",
            "python cli.py status --provisioning",
        ],
        "severity": "low",
        "confidence": "low",
        "safety_notes": (
            "Advisory only. Output was plain text, not structured JSON. "
            "Verify every suggestion against your SME/Vagrant logs."
        ),
    }


def call_openai_text(
    prompt: str,
    *,
    system_content: str,
    model: str = DEFAULT_MODEL,
    timeout_seconds: int | None = None,
    temperature: float | None = None,
) -> str:
    """Send a prompt and return plain-text assistant content."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise AIAnalysisError(
            "OPENAI_API_KEY is not set. Set it in your shell before running the AI assistant."
        )

    local_api = uses_local_llm_api()
    if timeout_seconds is None:
        timeout_seconds = LOCAL_LLM_TIMEOUT_SECONDS if local_api else DEFAULT_TIMEOUT_SECONDS
    if temperature is None:
        temperature = 0.3 if local_api else 0.2

    payload: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ],
    }

    req = request.Request(
        url=f"{_api_base_url()}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise AIAnalysisError(
            f"OpenAI API request failed with status {exc.code}: {body}"
        ) from exc
    except error.URLError as exc:
        raise AIAnalysisError(f"Unable to reach OpenAI API: {exc}") from exc

    try:
        return str(response_payload["choices"][0]["message"]["content"]).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise AIAnalysisError(
            f"Unexpected API response format: {json.dumps(response_payload, indent=2)}"
        ) from exc


def call_openai_json(
    prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    timeout_seconds: int | None = None,
) -> dict[str, Any]:
    """Send a prompt to OpenAI's Chat Completions API and parse a JSON response."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise AIAnalysisError(
            "OPENAI_API_KEY is not set. Set it in your shell before running the AI assistant."
        )

    local_api = uses_local_llm_api()
    if timeout_seconds is None:
        timeout_seconds = LOCAL_LLM_TIMEOUT_SECONDS if local_api else DEFAULT_TIMEOUT_SECONDS

    system_content = (
        "You are a cautious infrastructure troubleshooting assistant for Linux VMs, "
        "Vagrant, and Ansible. Respond with ONE valid JSON object only — no markdown, "
        "no code fences, no text before or after the JSON. "
        f"Use exactly these keys: {JSON_SCHEMA_HINT}. "
        "Base answers only on the log excerpt provided. "
        "Do not invent Windows or smbclient issues unless they appear in the logs. "
        "Never recommend automatic execution."
    )

    user_content = prompt
    if local_api:
        user_content = (
            f"{prompt}\n\n"
            "IMPORTANT: Reply with ONLY one JSON object using the required keys. "
            "No markdown, no bullet lists outside JSON, no Windows-specific advice "
            "unless the log excerpt explicitly shows it."
        )

    payload: dict[str, Any] = {
        "model": model,
        "temperature": 0.1 if local_api else 0.2,
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ],
    }
    # Do not set format=json for Ollama — llama3.2 often returns {} with no fields.

    req = request.Request(
        url=f"{_api_base_url()}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise AIAnalysisError(
            f"OpenAI API request failed with status {exc.code}: {body}"
        ) from exc
    except error.URLError as exc:
        raise AIAnalysisError(f"Unable to reach OpenAI API: {exc}") from exc

    try:
        raw_content = response_payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIAnalysisError(
            f"Unexpected OpenAI response format: {json.dumps(response_payload, indent=2)}"
        ) from exc

    try:
        parsed = parse_model_json(raw_content)
    except AIAnalysisError:
        if local_api:
            print(
                "[!] Warning: local model returned plain text instead of JSON; "
                "showing a best-effort summary.\n"
            )
            return coerce_plain_text_response(raw_content)
        raise

    if analysis_is_usable(parsed):
        return parsed

    if local_api and raw_content.strip() not in ("", "{}", "[]"):
        print(
            "[!] Warning: local model returned empty JSON fields; "
            "showing a best-effort summary.\n"
        )
        coerced = coerce_plain_text_response(raw_content)
        if analysis_is_usable(coerced):
            return coerced

    return parsed


def parse_model_json(raw_content: str) -> dict[str, Any]:
    """Parse JSON from a raw model response, stripping any code fences."""
    cleaned = raw_content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].lstrip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise AIAnalysisError(
            "Model response did not contain a JSON object. "
            f"Raw response was:\n{raw_content}"
        )

    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise AIAnalysisError(
            "Model returned invalid JSON. "
            f"Raw response was:\n{raw_content}"
        ) from exc


def normalise_analysis(data: dict[str, Any]) -> dict[str, Any]:
    """Coerce common fields into a predictable structure for printing."""
    commands = data.get("commands_to_try", [])
    if isinstance(commands, str):
        commands = [line.strip("- ").strip() for line in commands.splitlines() if line.strip()]
    if not isinstance(commands, list):
        commands = [str(commands)]

    return {
        "summary": str(data.get("summary", "No summary returned.")).strip(),
        "likely_cause": str(data.get("likely_cause", "No likely cause returned.")).strip(),
        "suggested_fix": str(data.get("suggested_fix", "No suggested fix returned.")).strip(),
        "commands_to_try": [str(item).strip() for item in commands if str(item).strip()],
        "severity": (str(data.get("severity") or "unknown").strip().lower() or "unknown"),
        "confidence": (str(data.get("confidence") or "unknown").strip().lower() or "unknown"),
        "safety_notes": str(data.get("safety_notes", SAFETY_NOTE)).strip(),
    }


def render_analysis(title: str, analysis: dict[str, Any]) -> str:
    """Render a structured advisory report for the terminal."""
    normalised = normalise_analysis(analysis)

    lines = [
        title,
        "=" * len(title),
        "",
        f"Severity: {normalised['severity']}",
        f"Confidence: {normalised['confidence']}",
        "",
        "Summary:",
        normalised["summary"],
        "",
        "Likely cause:",
        normalised["likely_cause"],
        "",
        "Suggested fix:",
        normalised["suggested_fix"],
        "",
        "Commands to try:",
    ]

    if normalised["commands_to_try"]:
        lines.extend(f"- {command}" for command in normalised["commands_to_try"])
    else:
        lines.append("- No commands suggested.")

    lines.extend(
        [
            "",
            "Safety notes:",
            normalised["safety_notes"] or SAFETY_NOTE,
        ]
    )
    return "\n".join(lines)
