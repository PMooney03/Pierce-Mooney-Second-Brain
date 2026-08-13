"""Free live weather via Open-Meteo (no API key)."""

from __future__ import annotations

import re

import httpx

from app.logging_config import get_logger
from app.tools.web_lookup import WebSnippet

logger = get_logger(__name__)

_WEATHER_RE = re.compile(
    r"\b("
    r"weather|temperature|forecast|humidity|windy|"
    r"raining|rainy|snowing|how hot|how cold|degrees"
    r")\b",
    re.I,
)

_LOCATION_RE = re.compile(
    r"\b(?:in|for|at|near)\s+([A-Za-z][A-Za-z .'\-]{1,48})"
    r"(?:\s*\?|\s*$)",
    re.I,
)

_LOCATION_BARE_RE = re.compile(
    r"^\s*(?:what(?:'?s| is)?\s+)?(?:the\s+)?weather(?:\s+like)?\s+([A-Za-z][A-Za-z .'\-]{1,40})\s*\??\s*$",
    re.I,
)

# WMO weather interpretation codes (subset)
_WMO = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def is_weather_query(text: str) -> bool:
    return bool(_WEATHER_RE.search(text or ""))


def extract_location(text: str) -> str | None:
    m = _LOCATION_RE.search(text or "")
    if m:
        loc = m.group(1).strip(" .,?!")
        # Drop trailing filler words
        loc = re.sub(r"\b(today|now|please|right now)\b", "", loc, flags=re.I).strip(" .,?!")
        if len(loc) >= 2:
            return loc
    m2 = _LOCATION_BARE_RE.match(text or "")
    if m2:
        return m2.group(1).strip(" .,?!")
    return None


def lookup_weather(
    query: str,
    *,
    default_location: str = "Dublin",
    timeout: float = 8.0,
) -> list[WebSnippet]:
    """Return a live weather snippet, or a note asking for a city."""
    if not is_weather_query(query):
        return []

    location = extract_location(query) or (default_location.strip() or None)
    if not location:
        return [
            WebSnippet(
                title="Weather",
                text=(
                    "The student asked about weather but no city was given. "
                    "Ask which city/town to check, then answer once you have a place."
                ),
                url="https://open-meteo.com/",
                provider="Open-Meteo",
            )
        ]

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            geo = client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": location, "count": 1, "language": "en", "format": "json"},
            )
            geo.raise_for_status()
            results = (geo.json() or {}).get("results") or []
            if not results:
                return [
                    WebSnippet(
                        title="Weather",
                        text=f'Could not find a place matching "{location}". Ask the student to clarify the city.',
                        url="https://open-meteo.com/",
                        provider="Open-Meteo",
                    )
                ]
            place = results[0]
            lat = place["latitude"]
            lon = place["longitude"]
            label = ", ".join(
                x for x in [place.get("name"), place.get("admin1"), place.get("country")] if x
            )

            wx = client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature",
                    "timezone": "auto",
                },
            )
            wx.raise_for_status()
            current = (wx.json() or {}).get("current") or {}
            code = int(current.get("weather_code") or 0)
            cond = _WMO.get(code, f"Weather code {code}")
            temp = current.get("temperature_2m")
            feels = current.get("apparent_temperature")
            humidity = current.get("relative_humidity_2m")
            wind = current.get("wind_speed_10m")
            when = current.get("time") or "now"

            text = (
                f"Live weather for {label} (as of {when}, Open-Meteo):\n"
                f"- Conditions: {cond}\n"
                f"- Temperature: {temp}°C (feels like {feels}°C)\n"
                f"- Humidity: {humidity}%\n"
                f"- Wind: {wind} km/h\n"
                "Answer using these figures. Do NOT say you lack weather access or send them to Weather.com."
            )
            return [
                WebSnippet(
                    title=f"Weather · {label}",
                    text=text,
                    url=f"https://open-meteo.com/",
                    provider="Open-Meteo",
                )
            ]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Weather lookup failed: %s", exc)
        return [
            WebSnippet(
                title="Weather",
                text=f"Weather lookup failed ({exc}). Say you couldn't reach the weather service right now.",
                url="https://open-meteo.com/",
                provider="Open-Meteo",
            )
        ]
