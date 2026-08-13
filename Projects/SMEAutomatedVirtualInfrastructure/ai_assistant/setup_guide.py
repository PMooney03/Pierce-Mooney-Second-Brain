"""Interactive first-run setup guide for the SME infrastructure CLI."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib import error, request

from ai_assistant.common import DEFAULT_BASE_URL, uses_local_llm_api

# Import CONFIGURATION_PRESETS from cli when run as part of the project
try:
    from cli import CONFIGURATION_PRESETS, check_prerequisites
except ImportError:  # pragma: no cover
    CONFIGURATION_PRESETS = {}
    check_prerequisites = None  # type: ignore


SETUP_ORDER = ("development", "minimal", "basic", "standard", "production")


def ollama_reachable() -> bool:
    try:
        with request.urlopen("http://localhost:11434/api/tags", timeout=2) as response:
            return response.status == 200
    except (error.URLError, OSError, ValueError):
        return False


def ai_assistant_configured() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())


def print_banner() -> None:
    print()
    print("SME Automated Virtual Infrastructure — Setup Guide")
    print("=" * 52)
    print()
    print("This walkthrough helps you bring VMs up step by step.")
    print("Commands are shown for you to run; nothing starts unless you use --run-up.")
    print()


def print_preset_table() -> None:
    print("Choose a preset (RAM and time are approximate):")
    print()
    for key in SETUP_ORDER:
        if key not in CONFIGURATION_PRESETS:
            continue
        info = CONFIGURATION_PRESETS[key]
        hosts = ", ".join(info["hosts"])
        print(f"  {key:12}  {len(info['hosts'])} VMs")
        print(f"               {info['description']}")
        print(f"               Hosts: {hosts}")
        print(f"               Note: {info['warning']}")
        print()


def choose_preset(requested: str | None) -> str | None:
    if requested and requested in CONFIGURATION_PRESETS:
        return requested

    print_preset_table()
    print("Recommended first run: minimal or development")
    print()
    while True:
        try:
            choice = input("Enter preset name (or press Enter for minimal): ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nCancelled.")
            return None
        if not choice:
            return "minimal"
        if choice in CONFIGURATION_PRESETS:
            return choice
        print(f"[!] Unknown preset '{choice}'. Try: {', '.join(SETUP_ORDER)}")


def print_ollama_section() -> None:
    print("--- AI assistant (optional, free with Ollama) ---")
    print()
    if ollama_reachable():
        print("[OK] Ollama is running on http://localhost:11434")
        if not ai_assistant_configured():
            print("Set these in PowerShell before using ai-log:")
            print('  $env:OPENAI_API_KEY = "ollama"')
            print('  $env:OPENAI_BASE_URL = "http://localhost:11434/v1"')
            print('  $env:OPENAI_MODEL = "llama3.2"   # or a model from: ollama list')
        else:
            base = os.environ.get("OPENAI_BASE_URL", DEFAULT_BASE_URL)
            model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
            print(f"[OK] API key set — base: {base}, model: {model}")
    else:
        print("[ ] Ollama not detected. Install from https://ollama.com for free local AI.")
        print("    You can still complete setup without AI.")
    print()
    print("After bring-up, analyse saved logs with:")
    print("  python cli.py ai-log --latest")
    print("  python cli.py ai-log --host-debug dc-1")
    print()


def print_bring_up_steps(preset: str) -> None:
    info = CONFIGURATION_PRESETS[preset]
    print("--- Bring up VMs ---")
    print()
    print(f"Preset: {preset}")
    print(f"  {info['description']}")
    print(f"  VMs: {', '.join(info['hosts'])}")
    print()
    print("Run from the project root:")
    print()
    print(f"  python cli.py up --preset {preset}")
    print()
    print("Or install the CLI and use:")
    print(f"  sme-spinup up --preset {preset}")
    print()
    print("Windows: when Vagrant asks which network to bridge, pick your main")
    print("  Ethernet/Wi-Fi adapter (often 'Realtek ...'), not VPN or Hyper-V.")
    print()
    print("First boot can take 15–45+ minutes depending on preset.")
    print("Output is saved under logs/vagrant/ for later AI analysis.")
    print()


def print_after_up_steps(preset: str) -> None:
    print("--- After VMs are running ---")
    print()
    print("  python cli.py status --provisioning")
    print("  python cli.py deploy")
    print("  python cli.py gui")
    print()
    if preset in ("minimal", "basic", "standard", "production"):
        print("Access (when provisioned):")
        print("  Grafana:    http://192.168.56.40:3000  (monitor-1 in larger presets)")
        print("  Web:        http://192.168.56.30       (web-1)")
    print()


def fetch_ai_setup_tips(preset: str) -> str | None:
    """Optional short AI tips; returns None if unavailable."""
    if not ai_assistant_configured():
        return None
    if uses_local_llm_api() and not ollama_reachable():
        return None

    hosts = ", ".join(CONFIGURATION_PRESETS[preset]["hosts"])
    prompt = (
        f"You are helping a student start the SME Vagrant lab with preset '{preset}' "
        f"(hosts: {hosts}). Give a short numbered checklist (max 6 steps) for Windows: "
        "prerequisites, vagrant up, bridged NIC choice, status check, and ai-log --latest "
        "if something fails. Plain text only, no JSON, under 400 words."
    )
    try:
        # Temporary override: use plain response, not JSON parser path
        from ai_assistant.common import _api_base_url, LOCAL_LLM_TIMEOUT_SECONDS, DEFAULT_MODEL
        import json as json_mod
        from urllib import request as urlrequest

        api_key = os.environ.get("OPENAI_API_KEY", "")
        model = os.environ.get("OPENAI_MODEL", DEFAULT_MODEL)
        payload = {
            "model": model,
            "temperature": 0.3,
            "messages": [
                {"role": "system", "content": "You are a concise lab setup tutor."},
                {"role": "user", "content": prompt},
            ],
        }
        req = urlrequest.Request(
            f"{_api_base_url()}/chat/completions",
            data=json_mod.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        timeout = LOCAL_LLM_TIMEOUT_SECONDS if uses_local_llm_api() else 60
        with urlrequest.urlopen(req, timeout=timeout) as response:
            body = json_mod.loads(response.read().decode("utf-8"))
        return body["choices"][0]["message"]["content"].strip()
    except Exception:
        return None


def run_setup_guide(
    *,
    preset: str | None = None,
    run_up: bool = False,
    dry_run: bool = False,
    ask_ai_tips: bool = True,
    project_root: Path | None = None,
) -> int:
    """Print interactive setup guidance. Returns a process exit code."""
    project_root = project_root or Path(__file__).resolve().parent.parent
    os.chdir(project_root)

    print_banner()

    if check_prerequisites is not None:
        print("--- Prerequisites ---")
        print()
        if not check_prerequisites():
            print("Fix missing tools, then run:  python cli.py start")
            return 1
        print("[OK] Vagrant is available.")
        print()

    chosen = choose_preset(preset)
    if not chosen:
        return 1

    print_ollama_section()
    print_bring_up_steps(chosen)
    print_after_up_steps(chosen)

    if ask_ai_tips and ai_assistant_configured():
        try:
            answer = input("Fetch optional AI setup tips for this preset? [y/N]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = "n"
        if answer in ("y", "yes"):
            print()
            print("--- AI setup tips ---")
            print()
            tips = fetch_ai_setup_tips(chosen)
            if tips:
                print(tips)
            else:
                print("[!] Could not fetch AI tips. Follow the steps above.")
            print()

    if run_up:
        print("--- Starting VMs now ---")
        print()
        if dry_run:
            print(f"[dry run] would run: python cli.py up --preset {chosen}")
            return 0
        # Delegate to existing CLI up flow
        from cli import get_preset_hosts, run_vagrant_command

        hosts = get_preset_hosts(chosen)
        if not hosts:
            return 1
        success = run_vagrant_command("up", hosts, dry_run=False)
        if success:
            print()
            print("[OK] Bring-up finished. Next:")
            print("  python cli.py status --provisioning")
            print("  python cli.py ai-log --latest")
        else:
            print()
            print("[!] Bring-up had errors. Analyse with:")
            print("  python cli.py ai-log --latest")
        return 0 if success else 1

    print("--- Ready ---")
    print()
    print("Copy the 'up' command above, or re-run with:")
    print(f"  python cli.py start --preset {chosen} --run-up")
    print()
    return 0
