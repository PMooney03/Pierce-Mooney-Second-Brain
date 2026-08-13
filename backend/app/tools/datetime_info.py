"""Local date/time helper."""

from __future__ import annotations

import re
from datetime import datetime, timezone

_TIME_RE = re.compile(
    r"\b("
    r"what(?:'?s| is)?\s+the\s+time|what\s+time\s+is\s+it|"
    r"current\s+time|date\s+today|what(?:'?s| is)?\s+the\s+date|"
    r"what\s+day\s+is\s+it|timezone"
    r")\b",
    re.I,
)


def wants_datetime(text: str) -> bool:
    return bool(_TIME_RE.search(text or ""))


def current_datetime_block(tz_name: str = "local") -> str:
    now = datetime.now().astimezone()
    utc = datetime.now(timezone.utc)
    label = now.tzname() or tz_name
    return (
        f"Local datetime ({label}): {now.strftime('%A, %d %B %Y %H:%M:%S %Z')} "
        f"(ISO {now.isoformat(timespec='seconds')}; UTC {utc.strftime('%H:%M:%S')})"
    )
