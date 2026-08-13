"""Shared analysis runners for CLI and standalone scripts."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from ai_assistant.common import (
    AIAnalysisError,
    DEFAULT_MODEL,
    analysis_is_usable,
    call_openai_json,
    extract_log_excerpt,
    heuristic_log_analysis,
    load_prompt_file,
    prepare_alert_prompt,
    prepare_setup_log_prompt,
    read_json_file,
    read_text_file,
    render_analysis,
)


def check_api_key_configured() -> str | None:
    """Return an error message when OPENAI_API_KEY is missing, else None."""
    import os

    if not os.environ.get("OPENAI_API_KEY", "").strip():
        return (
            "OPENAI_API_KEY is not set. Set it in your shell before running the AI assistant.\n"
            "  PowerShell:  $env:OPENAI_API_KEY = \"your-api-key\"\n"
            "  bash:        export OPENAI_API_KEY=\"your-api-key\""
        )
    return None


def analyse_setup_log_text(
    source_name: str,
    log_text: str,
    *,
    model: str | None = None,
    max_lines: int = 200,
    show_excerpt: bool = False,
) -> int:
    """Analyse log text and print an advisory report. Returns a process exit code."""
    key_error = check_api_key_configured()
    if key_error:
        print(f"[!] {key_error}")
        return 1

    excerpt = extract_log_excerpt(log_text, max_lines=max_lines)

    if show_excerpt:
        print("Extracted log excerpt")
        print("=====================")
        print(excerpt)
        print()

    prompt_template = load_prompt_file("setup_troubleshooting.txt")
    prompt = prepare_setup_log_prompt(prompt_template, source_name, excerpt)

    try:
        response = call_openai_json(prompt, model=model or DEFAULT_MODEL)
    except AIAnalysisError as exc:
        print(f"[!] AI analysis failed: {exc}")
        return 1

    if not analysis_is_usable(response):
        print(
            "[!] Warning: local model returned empty JSON; "
            "using log-based fallback analysis.\n"
        )
        response = heuristic_log_analysis(log_text)

    print(render_analysis(f"AI Setup Analysis: {source_name}", response))
    return 0


def analyse_setup_log_file(
    log_path: str | Path,
    *,
    model: str | None = None,
    max_lines: int = 200,
    show_excerpt: bool = False,
) -> int:
    path = Path(log_path)
    if not path.exists():
        print(f"[!] Log file not found: {path}")
        return 1

    return analyse_setup_log_text(
        path.name,
        read_text_file(path),
        model=model,
        max_lines=max_lines,
        show_excerpt=show_excerpt,
    )


def analyse_alert_payload(
    source_name: str,
    alert_payload: Any,
    *,
    model: str | None = None,
) -> int:
    """Analyse alert JSON data and print an advisory report. Returns a process exit code."""
    key_error = check_api_key_configured()
    if key_error:
        print(f"[!] {key_error}")
        return 1

    prompt_template = load_prompt_file("alert_analysis.txt")
    prompt = prepare_alert_prompt(
        prompt_template,
        source_name,
        json.dumps(alert_payload, indent=2),
    )

    try:
        response = call_openai_json(prompt, model=model or DEFAULT_MODEL)
    except AIAnalysisError as exc:
        print(f"[!] AI analysis failed: {exc}")
        return 1

    print(render_analysis(f"AI Alert Analysis: {source_name}", response))
    return 0


def analyse_alert_file(
    alert_path: str | Path,
    *,
    model: str | None = None,
) -> int:
    path = Path(alert_path)
    if not path.exists():
        print(f"[!] Alert file not found: {path}")
        return 1

    try:
        alert_payload = read_json_file(path)
    except json.JSONDecodeError as exc:
        print(f"[!] Alert file is not valid JSON: {exc}")
        return 1

    return analyse_alert_payload(path.name, alert_payload, model=model)


def _parse_log_source_marker(output: str) -> tuple[str, str]:
    """Split LOG_SOURCE:path header from remote fetch output."""
    lines = output.splitlines()
    if lines and lines[0].startswith("LOG_SOURCE:"):
        return lines[0].split(":", 1)[1], "\n".join(lines[1:]).strip()
    return "/var/log/syslog", output.strip()


def fetch_host_provision_log(
    host: str,
    *,
    vagrant_cwd: Path,
    tail_lines: int = 200,
) -> tuple[int, str, str]:
    """Fetch recent provisioning log output from a VM via Vagrant SSH.

    Returns (exit_code, log_text, source_label).
    """
    # Use sudo for all reads: provision/syslog files are often root-owned on Ubuntu.
    # Prefer vagrant-provision.log, then filtered syslog (skip cloud-init — wrong era for Vagrant).
    command = (
        f"if sudo test -f /var/log/vagrant-provision.log 2>/dev/null; then "
        f"echo LOG_SOURCE:/var/log/vagrant-provision.log; "
        f"sudo tail -n {tail_lines} /var/log/vagrant-provision.log; "
        f"else "
        f"echo LOG_SOURCE:/var/log/syslog; "
        f"sudo grep -iE 'error|failed|fatal|exception|provision|bootstrap|slapd|bind9|vagrant|apt-' "
        f"/var/log/syslog 2>/dev/null | tail -n {tail_lines} "
        f"|| sudo tail -n {tail_lines} /var/log/syslog; "
        f"fi"
    )
    try:
        result = subprocess.run(
            ["vagrant", "ssh", host, "-c", command],
            cwd=str(vagrant_cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
    except FileNotFoundError:
        return 1, "", "Vagrant is not installed or not available on PATH."
    except subprocess.TimeoutExpired:
        return 1, "", f"Timed out fetching provisioning log from {host}."
    except OSError as exc:
        return 1, "", f"Unable to fetch provisioning log from {host}: {exc}"

    output = (result.stdout or "").strip()
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        details = "\n".join(part for part in (stderr, output) if part).strip()
        if not details:
            details = f"vagrant ssh failed with exit code {result.returncode}"
        return result.returncode, "", details

    if not output:
        return 1, "", (
            f"No log output returned from {host}. "
            "Save local Vagrant output to a file and run: python cli.py ai-log <path>"
        )

    source_label, log_text = _parse_log_source_marker(output)
    if not log_text:
        return 1, "", (
            f"No log content found on {host}. "
            "Save local Vagrant output to a file and run: python cli.py ai-log <path>"
        )

    return 0, log_text, source_label


def analyse_host_provision_log(
    host: str,
    *,
    vagrant_cwd: Path,
    model: str | None = None,
    max_lines: int = 200,
    show_excerpt: bool = False,
    tail_lines: int = 200,
) -> int:
    """Fetch a host provisioning log over SSH and analyse it."""
    exit_code, log_text, source_label = fetch_host_provision_log(
        host,
        vagrant_cwd=vagrant_cwd,
        tail_lines=tail_lines,
    )
    if exit_code != 0:
        print(f"[!] {source_label}")
        return 1

    if source_label != "/var/log/vagrant-provision.log":
        print(
            f"Note: /var/log/vagrant-provision.log is not on {host} yet; "
            f"analysing {source_label} instead.\n"
            f"  Re-run 'vagrant provision {host}' to capture a dedicated provision log next time.\n"
        )

    context_prefix = (
        f"Analysing host: {host}. SME lab VM (Ubuntu/Vagrant). "
        "Errors to 192.168.56.11 / dc-2 often mean the second domain controller "
        "is not running yet if you only started dc-1.\n\n"
    )
    return analyse_setup_log_text(
        f"{host}:{source_label}",
        context_prefix + log_text,
        model=model,
        max_lines=max_lines,
        show_excerpt=show_excerpt,
    )
