"""Ollama HTTP client for chat and embeddings."""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from typing import Any

import httpx

from app.logging_config import get_logger

logger = get_logger(__name__)

_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.S | re.I)


def _assistant_text(message: dict[str, Any], *, allow_thinking: bool = False) -> str:
    """Visible reply text from Ollama (gpt-oss may put the answer in thinking).

    Do not strip whitespace — stream chunks are often a single space or newline.
    """
    raw = message.get("content")
    if isinstance(raw, list):
        bits: list[str] = []
        for item in raw:
            if isinstance(item, str):
                bits.append(item)
            elif isinstance(item, dict):
                piece = item.get("text") or item.get("content") or ""
                if isinstance(piece, str):
                    bits.append(piece)
        raw = "".join(bits)
    if isinstance(raw, str) and raw != "":
        return _THINK_BLOCK_RE.sub("", raw)
    if allow_thinking:
        think = message.get("thinking") or message.get("reasoning") or ""
        if isinstance(think, str) and think:
            return _THINK_BLOCK_RE.sub("", think)
    return ""


def _stream_delta(previous: str, incoming: str) -> tuple[str, str]:
    """Return (new_text, updated_previous) for snapshot-or-delta streams."""
    if not incoming:
        return "", previous
    if previous and incoming.startswith(previous):
        return incoming[len(previous) :], incoming
    if incoming == previous:
        return "", previous
    return incoming, previous + incoming


class OllamaError(RuntimeError):
    """Raised when Ollama is unreachable or a model call fails."""


class OllamaClient:
    """Minimal client for local Ollama API."""

    def __init__(self, base_url: str, chat_model: str, embed_model: str, timeout: float = 120.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.chat_model = chat_model
        self.embed_model = embed_model
        self.timeout = timeout

    def _client(self, *, read_timeout: float | None = None) -> httpx.Client:
        read = read_timeout if read_timeout is not None else self.timeout
        return httpx.Client(
            base_url=self.base_url,
            timeout=httpx.Timeout(connect=10.0, read=read, write=30.0, pool=10.0),
        )

    def is_reachable(self) -> bool:
        try:
            with self._client() as client:
                r = client.get("/api/tags")
                return r.status_code == 200
        except httpx.HTTPError:
            return False

    def list_models(self) -> list[str]:
        try:
            with self._client() as client:
                r = client.get("/api/tags")
                r.raise_for_status()
                data = r.json()
                return [m.get("name", "") for m in data.get("models", [])]
        except httpx.HTTPError as exc:
            raise OllamaError(
                f"Cannot reach Ollama at {self.base_url}. "
                "Start it with `ollama serve` (or the Ollama app)."
            ) from exc

    def health(self) -> dict[str, Any]:
        """Return structured health info for /api/health."""
        try:
            models = self.list_models()
        except OllamaError as exc:
            return {
                "ok": False,
                "reachable": False,
                "error": str(exc),
                "chat_model": self.chat_model,
                "embed_model": self.embed_model,
                "chat_model_available": False,
                "embed_model_available": False,
                "models": [],
            }

        def _available(wanted: str) -> bool:
            if wanted in models:
                return True
            # Allow tag-less match (llama3.2 == llama3.2:latest)
            base = wanted.split(":")[0]
            return any(m == wanted or m.startswith(base + ":") or m.split(":")[0] == base for m in models)

        chat_ok = _available(self.chat_model)
        embed_ok = _available(self.embed_model)
        return {
            "ok": chat_ok and embed_ok,
            "reachable": True,
            "error": None
            if (chat_ok and embed_ok)
            else (
                "Missing models. Pull with: "
                + " ".join(
                    f"`ollama pull {m}`"
                    for m, ok in ((self.chat_model, chat_ok), (self.embed_model, embed_ok))
                    if not ok
                )
            ),
            "chat_model": self.chat_model,
            "embed_model": self.embed_model,
            "chat_model_available": chat_ok,
            "embed_model_available": embed_ok,
            "models": models,
        }

    def embed(self, text: str, *, max_chars: int = 2400, retries: int = 3) -> list[float]:
        if not text.strip():
            raise OllamaError("Cannot embed empty text")
        # Keep well under typical local embedding context windows.
        payload_text = text.strip()
        if len(payload_text) > max_chars:
            payload_text = payload_text[:max_chars]

        last_error: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                with self._client() as client:
                    r = client.post(
                        "/api/embeddings",
                        json={"model": self.embed_model, "prompt": payload_text},
                    )
                    if r.status_code == 404:
                        # Newer Ollama uses /api/embed
                        r = client.post(
                            "/api/embed",
                            json={"model": self.embed_model, "input": payload_text},
                        )
                    if r.status_code >= 500 and attempt < retries:
                        last_error = httpx.HTTPStatusError(
                            f"{r.status_code}", request=r.request, response=r
                        )
                        continue
                    r.raise_for_status()
                    data = r.json()
                    if "embedding" in data:
                        return list(data["embedding"])
                    if "embeddings" in data and data["embeddings"]:
                        return list(data["embeddings"][0])
                    raise OllamaError(f"Unexpected embed response keys: {list(data.keys())}")
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt < retries:
                    continue
                raise OllamaError(
                    f"Embedding failed with model '{self.embed_model}': {exc}. "
                    f"Ensure it is pulled: ollama pull {self.embed_model}"
                ) from exc
        raise OllamaError(f"Embedding failed after retries: {last_error}")

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(t) for t in texts]

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.2,
        stream: bool = False,
    ) -> str:
        if stream:
            return "".join(self.iter_chat(messages, temperature=temperature))
        try:
            with self._client() as client:
                r = client.post(
                    "/api/chat",
                    json={
                        "model": self.chat_model,
                        "messages": messages,
                        "stream": False,
                        "think": False,
                        "options": {"temperature": temperature, "num_predict": 1536},
                    },
                )
                r.raise_for_status()
                data = r.json()
                message = data.get("message") or {}
                content = _assistant_text(message, allow_thinking=True)
                if not content:
                    raise OllamaError("Empty response from Ollama chat")
                return content
        except httpx.HTTPError as exc:
            raise OllamaError(
                f"Chat failed with model '{self.chat_model}': {exc}. "
                f"Ensure it is pulled: ollama pull {self.chat_model}"
            ) from exc

    def iter_chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.2,
    ) -> Iterator[str]:
        """Yield incremental assistant text chunks from Ollama (`stream: true`)."""
        try:
            with self._client(read_timeout=max(300.0, self.timeout)) as client:
                with client.stream(
                    "POST",
                    "/api/chat",
                    json={
                        "model": self.chat_model,
                        "messages": messages,
                        "stream": True,
                        "think": False,
                        "options": {"temperature": temperature, "num_predict": 1536},
                    },
                ) as r:
                    r.raise_for_status()
                    yielded = False
                    seen_content = ""
                    seen_thinking = ""
                    last_message: dict[str, Any] = {}
                    for line in r.iter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        message = data.get("message") or {}
                        if isinstance(message, dict):
                            last_message = message
                        content = _assistant_text(message, allow_thinking=False)
                        delta, seen_content = _stream_delta(seen_content, content)
                        if delta:
                            yielded = True
                            yield delta
                        think = message.get("thinking") or message.get("reasoning") or ""
                        if isinstance(think, str) and think:
                            _, seen_thinking = _stream_delta(seen_thinking, think)
                        if data.get("done"):
                            if not yielded:
                                leftover = _assistant_text(last_message, allow_thinking=True)
                                if leftover:
                                    piece, _ = _stream_delta("", leftover)
                                    if piece:
                                        yield piece
                                elif seen_thinking:
                                    yield seen_thinking
                            break
        except httpx.HTTPError as exc:
            raise OllamaError(
                f"Chat stream failed with model '{self.chat_model}': {exc}. "
                f"Ensure it is pulled: ollama pull {self.chat_model}"
            ) from exc
