"""Record Vagrant CLI output for later AI-assisted troubleshooting."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path


def vagrant_logs_dir(project_root: Path) -> Path:
    directory = project_root / "logs" / "vagrant"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def begin_vagrant_session(project_root: Path, command: str, hosts: list[str]) -> Path:
    """Create a new session log file and mark it as LATEST."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    host_slug = "-".join(hosts) if hosts else "all"
    if len(host_slug) > 96:
        host_slug = host_slug[:96]

    log_path = vagrant_logs_dir(project_root) / f"{command}-{timestamp}-{host_slug}.log"
    header = (
        "# SME Vagrant session log\n"
        f"# command: vagrant {command}\n"
        f"# hosts: {', '.join(hosts) if hosts else '(none)'}\n"
        f"# started_utc: {datetime.now(timezone.utc).isoformat()}\n\n"
    )
    log_path.write_text(header, encoding="utf-8")
    (vagrant_logs_dir(project_root) / "LATEST").write_text(log_path.name, encoding="utf-8")
    return log_path


def append_vagrant_session(log_path: Path, line: str) -> None:
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(line)


def finish_vagrant_session(log_path: Path, return_code: int) -> None:
    footer = (
        f"\n# finished_utc: {datetime.now(timezone.utc).isoformat()}\n"
        f"# exit_code: {return_code}\n"
    )
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(footer)


def resolve_latest_vagrant_log(project_root: Path, *, command_prefix: str = "up") -> Path | None:
    """Return the most recent saved Vagrant session log, preferring the LATEST pointer."""
    log_dir = vagrant_logs_dir(project_root)
    latest_pointer = log_dir / "LATEST"
    if latest_pointer.exists():
        candidate = log_dir / latest_pointer.read_text(encoding="utf-8").strip()
        if candidate.exists():
            return candidate

    matches = sorted(
        log_dir.glob(f"{command_prefix}-*.log"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return matches[0] if matches else None
