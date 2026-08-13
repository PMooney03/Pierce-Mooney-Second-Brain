"""Recursive document scanner and file hashing."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.logging_config import get_logger

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".docx",
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
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".md",
    ".txt",
    ".json",
    ".yml",
    ".yaml",
    ".xml",
}

# Directories to ignore while scanning the project root as corpus
SKIP_DIR_NAMES = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    "backend",
    "frontend",
    "data",
    "scripts",
    ".cursor",
    "dist",
    "build",
    ".next",
    "coverage",
    "target",
    ".idea",
    ".vscode",
    "vendor",
    ".turbo",
    ".cache",
}


@dataclass
class ScannedFile:
    path: Path
    relative_path: str
    filename: str
    extension: str
    size: int
    modified_at: str
    file_hash: str


def compute_file_hash(path: Path, chunk_size: int = 1024 * 1024) -> str:
    """SHA-256 of file contents."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            block = f.read(chunk_size)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def _modified_iso(path: Path) -> str:
    ts = path.stat().st_mtime
    return datetime.fromtimestamp(ts, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def scan_documents(
    root: Path,
    *,
    extensions: set[str] | None = None,
) -> list[ScannedFile]:
    """Recursively find supported documents under root."""
    root = root.resolve()
    ext = extensions or SUPPORTED_EXTENSIONS
    found: list[ScannedFile] = []

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        try:
            rel_parts = path.relative_to(root).parts
        except ValueError:
            continue
        # Only skip ignored dirs relative to the corpus root (not parent path names).
        if any(part in SKIP_DIR_NAMES for part in rel_parts):
            continue
        if path.suffix.lower() not in ext:
            continue
        try:
            rel = str(path.relative_to(root)).replace("\\", "/")
            scanned = ScannedFile(
                path=path,
                relative_path=rel,
                filename=path.name,
                extension=path.suffix.lower(),
                size=path.stat().st_size,
                modified_at=_modified_iso(path),
                file_hash=compute_file_hash(path),
            )
            found.append(scanned)
        except OSError as exc:
            logger.warning("Skipping unreadable file %s: %s", path, exc)

    found.sort(key=lambda s: s.relative_path.lower())
    logger.info("Scan complete: %s supported files under %s", len(found), root)
    return found
