"""Free DuckDuckGo Instant Answer lookup (no API key)."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.logging_config import get_logger

logger = get_logger(__name__)

DDG_URL = "https://api.duckduckgo.com/"


@dataclass
class WebSnippet:
    title: str
    text: str
    url: str
    provider: str = "DuckDuckGo"


def _topic_text(item: object) -> tuple[str, str, str] | None:
    if not isinstance(item, dict):
        return None
    text = (item.get("Text") or "").strip()
    url = (item.get("FirstURL") or "").strip()
    if not text:
        return None
    title = text.split(" - ", 1)[0][:120] if " - " in text else text[:80]
    return title, text, url


def lookup(query: str, *, timeout: float = 8.0, max_snippets: int = 4) -> list[WebSnippet]:
    """Fetch Instant Answer / related topics, with live weather when relevant."""
    q = (query or "").strip()
    if len(q) < 2:
        return []

    # Live weather first (DDG Instant Answer has no real-time weather).
    try:
        from app.config import get_settings
        from app.tools.weather import is_weather_query, lookup_weather

        if is_weather_query(q):
            settings = get_settings()
            wx = lookup_weather(
                q,
                default_location=getattr(settings, "default_weather_location", "Dublin") or "Dublin",
                timeout=timeout,
            )
            if wx:
                return wx[:max_snippets]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Weather branch failed: %s", exc)

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(
                DDG_URL,
                params={
                    "q": q,
                    "format": "json",
                    "no_html": "1",
                    "skip_disambig": "1",
                },
                headers={"User-Agent": "AcademicSecondBrain/1.0 (local student assistant)"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Web lookup failed: %s", exc)
        return []

    out: list[WebSnippet] = []
    heading = (data.get("Heading") or "").strip()
    abstract = (data.get("AbstractText") or "").strip()
    abstract_url = (data.get("AbstractURL") or "").strip()
    if abstract:
        out.append(
            WebSnippet(
                title=heading or "Instant Answer",
                text=abstract[:1200],
                url=abstract_url or "https://duckduckgo.com/",
            )
        )

    answer = (data.get("Answer") or "").strip()
    if answer and answer not in {s.text for s in out}:
        out.append(
            WebSnippet(
                title=heading or "Answer",
                text=answer[:800],
                url=abstract_url or "https://duckduckgo.com/",
            )
        )

    definition = (data.get("Definition") or "").strip()
    if definition:
        out.append(
            WebSnippet(
                title="Definition",
                text=definition[:800],
                url=(data.get("DefinitionURL") or abstract_url or "https://duckduckgo.com/"),
            )
        )

    related = data.get("RelatedTopics") or []
    for item in related:
        if len(out) >= max_snippets:
            break
        if isinstance(item, dict) and "Topics" in item:
            for sub in item.get("Topics") or []:
                if len(out) >= max_snippets:
                    break
                parsed = _topic_text(sub)
                if parsed:
                    title, text, url = parsed
                    out.append(WebSnippet(title=title, text=text[:600], url=url or "https://duckduckgo.com/"))
            continue
        parsed = _topic_text(item)
        if parsed:
            title, text, url = parsed
            out.append(WebSnippet(title=title, text=text[:600], url=url or "https://duckduckgo.com/"))

    return out[:max_snippets]


def format_web_block(snippets: list[WebSnippet]) -> str:
    if not snippets:
        return ""
    lines = [
        "WEB LOOKUP (external context - Open-Meteo and/or DuckDuckGo).",
        "Use this data to answer. Prefer the student's archive for coursework-specific claims.",
        "If you use this, briefly say it came from a web/weather lookup.",
        "Never claim you lack weather access when weather data is present below.",
        "Never tell the user to check Weather.com if live weather data is present.",
    ]
    for i, s in enumerate(snippets, start=1):
        lines.append(f"W{i}. [{s.provider}] {s.title}\n{s.text}\nURL: {s.url}")
    return "\n".join(lines)


def snippets_to_citations(snippets: list[WebSnippet]):
    """Synthetic source cards for the UI."""
    from app.database.models import SourceCitation

    cites: list[SourceCitation] = []
    for i, s in enumerate(snippets, start=1):
        prefix = "web:wx" if s.provider == "Open-Meteo" else "web:ddg"
        cites.append(
            SourceCitation(
                document_id=0,
                chunk_id=f"{prefix}:{i}",
                filename=(
                    f"DuckDuckGo · {s.title}"
                    if s.provider == "DuckDuckGo"
                    else f"Web · {s.title}"
                )[:120],
                filepath=s.url or "https://duckduckgo.com/",
                page=None,
                heading=s.provider,
                text_preview=s.text[:420],
                year=None,
                module="DuckDuckGo" if s.provider == "DuckDuckGo" else "Web lookup",
            )
        )
    return cites
