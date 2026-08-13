"""Source code and plain-text extraction."""

from __future__ import annotations

import re
from pathlib import Path

from app.database.models import ExtractedBlock, ExtractedDocument
from app.ingestion.base_parser import DocumentParser

CODE_EXTENSIONS = {
    ".py",
    ".java",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".c",
    ".cc",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".kt",
    ".kts",
    ".swift",
    ".rb",
    ".php",
    ".sql",
    ".sh",
    ".bash",
    ".ps1",
    ".r",
    ".m",
    ".scala",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".vue",
    ".svelte",
    ".md",
    ".txt",
    ".json",
    ".yml",
    ".yaml",
    ".toml",
    ".xml",
    ".gradle",
    ".dockerfile",
}

SKIP_FILENAMES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "composer.lock",
    "poetry.lock",
    "cargo.lock",
}

# ~400KB text cap — keeps ingestion practical
MAX_CODE_BYTES = 400_000


class CodeParseError(Exception):
    """Raised when a source file cannot be usefully extracted."""


_DEF_PATTERNS = [
    re.compile(r"^(?P<head>\s*(?:export\s+)?(?:async\s+)?function\s+\w+.+)$", re.M),
    re.compile(r"^(?P<head>\s*(?:export\s+)?(?:default\s+)?class\s+\w+.+)$", re.M),
    re.compile(r"^(?P<head>\s*def\s+\w+\s*\(.*)$", re.M),
    re.compile(r"^(?P<head>\s*class\s+\w+.*:)$", re.M),
    re.compile(r"^(?P<head>\s*(?:public|private|protected).*\b\w+\s*\(.*\{\s*)$", re.M),
    re.compile(r"^(?P<head>\s*fn\s+\w+.+)$", re.M),
    re.compile(r"^(?P<head>\s*func\s+\w+.+)$", re.M),
    re.compile(r"^(?P<head>#{1,3}\s+.+)$", re.M),  # markdown headings
]


class CodeParser(DocumentParser):
    """Extract text from source / config / markdown files."""

    extensions = CODE_EXTENSIONS

    def parse(self, path: Path, relative_path: str) -> ExtractedDocument:
        name_lower = path.name.lower()
        if name_lower in SKIP_FILENAMES:
            raise CodeParseError(f"Skipped lockfile: {path.name}")
        if name_lower.endswith(".min.js") or name_lower.endswith(".min.css"):
            raise CodeParseError(f"Skipped minified file: {path.name}")
        if path.suffix.lower() == ".map":
            raise CodeParseError("Skipped source map")

        size = path.stat().st_size
        if size == 0:
            raise CodeParseError("Empty file")
        if size > MAX_CODE_BYTES:
            raise CodeParseError(f"File too large for code ingest ({size} bytes)")

        try:
            raw = path.read_bytes()
        except OSError as exc:
            raise CodeParseError(f"Cannot read file: {exc}") from exc

        # Reject obvious binaries
        if b"\x00" in raw[:8000]:
            raise CodeParseError("Binary file")

        text = None
        for enc in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                text = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if text is None:
            raise CodeParseError("Could not decode text")

        text = text.replace("\r\n", "\n").strip()
        if not text:
            raise CodeParseError("Empty text after decode")

        # Skip near-minified single-line blobs
        if "\n" not in text and len(text) > 4000:
            raise CodeParseError("Looks minified / single-line blob")

        blocks = self._to_blocks(text, path.suffix.lower())
        if not blocks:
            raise CodeParseError("No extractable code blocks")

        return ExtractedDocument(
            filepath=relative_path.replace("\\", "/"),
            filename=path.name,
            file_type=path.suffix.lower().lstrip(".") or "code",
            blocks=blocks,
            metadata={"language": path.suffix.lower().lstrip("."), "bytes": size},
        )

    def _to_blocks(self, text: str, ext: str) -> list[ExtractedBlock]:
        # Prefer structural splits for code; paragraph-ish for md/txt
        if ext in {".md", ".txt"}:
            parts = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
            blocks: list[ExtractedBlock] = []
            heading = None
            for part in parts:
                if part.lstrip().startswith("#"):
                    heading = part.split("\n", 1)[0].lstrip("#").strip()
                    blocks.append(
                        ExtractedBlock(text=part, heading=heading, block_type="heading")
                    )
                else:
                    blocks.append(
                        ExtractedBlock(text=part, heading=heading, block_type="paragraph")
                    )
            return blocks

        spans = self._split_by_defs(text)
        blocks = []
        for heading, body in spans:
            body = body.strip()
            if not body:
                continue
            # Keep units manageable for the chunker
            if len(body) > 6000:
                for i in range(0, len(body), 5000):
                    piece = body[i : i + 5000]
                    blocks.append(
                        ExtractedBlock(
                            text=piece,
                            heading=heading,
                            block_type="code",
                        )
                    )
            else:
                blocks.append(
                    ExtractedBlock(text=body, heading=heading, block_type="code")
                )
        return blocks

    def _split_by_defs(self, text: str) -> list[tuple[str | None, str]]:
        """Split file into (heading, body) using common definition lines."""
        lines = text.split("\n")
        cut_points: list[tuple[int, str | None]] = [(0, None)]
        for idx, line in enumerate(lines):
            for pat in _DEF_PATTERNS:
                if pat.match(line):
                    heading = line.strip()
                    if len(heading) > 120:
                        heading = heading[:117] + "..."
                    if idx > 0:
                        cut_points.append((idx, heading))
                    else:
                        cut_points[0] = (0, heading)
                    break

        # Deduplicate cut points
        unique: list[tuple[int, str | None]] = []
        seen_idx: set[int] = set()
        for item in cut_points:
            if item[0] in seen_idx:
                continue
            seen_idx.add(item[0])
            unique.append(item)
        unique.sort(key=lambda x: x[0])

        spans: list[tuple[str | None, str]] = []
        for i, (start, heading) in enumerate(unique):
            end = unique[i + 1][0] if i + 1 < len(unique) else len(lines)
            body = "\n".join(lines[start:end])
            spans.append((heading, body))

        # Fallback: fixed line windows
        if len(spans) <= 1 and len(lines) > 120:
            spans = []
            window = 80
            for i in range(0, len(lines), window):
                chunk_lines = lines[i : i + window]
                heading = f"lines {i + 1}-{i + len(chunk_lines)}"
                spans.append((heading, "\n".join(chunk_lines)))
        return spans
