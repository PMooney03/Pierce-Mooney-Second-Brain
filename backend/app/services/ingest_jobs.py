"""Background ingest job so OCR/embed does not block chat and other API routes."""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any, Callable

_lock = threading.Lock()
_state: dict[str, Any] = {
    "status": "idle",  # idle | running | done | error
    "started_at": None,
    "finished_at": None,
    "result": None,
    "error": None,
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def get_ingest_status() -> dict[str, Any]:
    with _lock:
        return {
            "status": _state["status"],
            "started_at": _state["started_at"],
            "finished_at": _state["finished_at"],
            "error": _state["error"],
            "result": _state["result"],
        }


def start_ingest_job(runner: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    """
    Start ingest in a daemon thread if idle/done/error.
    Returns current status payload (running if started or already running).
    """
    with _lock:
        if _state["status"] == "running":
            return get_ingest_status()
        _state["status"] = "running"
        _state["started_at"] = _utc_now()
        _state["finished_at"] = None
        _state["result"] = None
        _state["error"] = None

    def _run() -> None:
        try:
            result = runner()
            with _lock:
                _state["status"] = "done"
                _state["result"] = result
                _state["finished_at"] = _utc_now()
                _state["error"] = None
        except Exception as exc:  # noqa: BLE001
            with _lock:
                _state["status"] = "error"
                _state["error"] = str(exc)
                _state["finished_at"] = _utc_now()
                _state["result"] = None

    threading.Thread(target=_run, name="charlesgpt-ingest", daemon=True).start()
    return get_ingest_status()
