"""Browse Projects/<name> folders on disk (portfolio file explorer)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import PROJECT_ROOT

SKIP_DIR_NAMES = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".next",
    "dist",
    "build",
    "coverage",
    "target",
    ".turbo",
    ".cache",
    ".idea",
    ".vscode",
    "sme_starter_infra.egg-info",
}

TEXT_EXTENSIONS = {
    ".md",
    ".txt",
    ".json",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".cfg",
    ".env",
    ".example",
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
    ".scss",
    ".html",
    ".htm",
    ".xml",
    ".sql",
    ".sh",
    ".bash",
    ".ps1",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".cs",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".dockerfile",
    ".gitignore",
    ".dockerignore",
}

FULL_TEXT_CHARS = 200_000
PREVIEW_CHARS = 400


def projects_root() -> Path:
    return (PROJECT_ROOT / "Projects").resolve()


def list_project_folders() -> list[dict[str, Any]]:
    root = projects_root()
    if not root.is_dir():
        return []
    out: list[dict[str, Any]] = []
    for folder in sorted(root.iterdir(), key=lambda p: p.name.lower()):
        if not folder.is_dir() or folder.name.startswith("."):
            continue
        entries = _list_dir(folder)
        file_count = sum(1 for e in entries if e["kind"] == "file")
        dir_count = sum(1 for e in entries if e["kind"] == "dir")
        readme = next((e for e in entries if e["name"].lower() == "readme.md"), None)
        out.append(
            {
                "name": folder.name,
                "folder": f"Projects/{folder.name}",
                "file_count": file_count,
                "dir_count": dir_count,
                "has_readme": readme is not None,
            }
        )
    return out


def _safe_project_dir(name: str) -> Path:
    root = projects_root()
    if not root.is_dir():
        raise FileNotFoundError("Projects folder missing")
    raw = name.replace("\\", "/").strip("/")
    if "/" in raw or raw in {"", ".", ".."}:
        raise PermissionError("Invalid project name")
    matches = [p for p in root.iterdir() if p.is_dir() and p.name.lower() == raw.lower()]
    if not matches:
        raise FileNotFoundError(f"Project not found: {name}")
    return matches[0].resolve()


def _resolve_inside(project_dir: Path, rel: str) -> Path:
    rel = (rel or "").replace("\\", "/").strip("/")
    if ".." in Path(rel).parts:
        raise PermissionError("Invalid path")
    target = (project_dir / rel).resolve() if rel else project_dir.resolve()
    if not str(target).startswith(str(project_dir.resolve())):
        raise PermissionError("Path escapes project")
    return target


def _list_dir(path: Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    try:
        children = list(path.iterdir())
    except OSError:
        return []
    for child in sorted(children, key=lambda p: (not p.is_dir(), p.name.lower())):
        if child.name in SKIP_DIR_NAMES:
            continue
        if child.name.startswith(".") and child.name not in {".env.example", ".gitignore", ".dockerignore"}:
            # hide most dotfiles; keep common project meta
            if child.name not in {".gitignore", ".env.example", ".dockerignore"}:
                continue
        if child.is_dir():
            items.append(
                {
                    "name": child.name,
                    "kind": "dir",
                    "size": None,
                }
            )
        elif child.is_file():
            try:
                size = child.stat().st_size
            except OSError:
                size = None
            items.append(
                {
                    "name": child.name,
                    "kind": "file",
                    "size": size,
                    "ext": child.suffix.lower() or None,
                }
            )
    return items


def browse_project(name: str, rel_path: str = "") -> dict[str, Any]:
    project_dir = _safe_project_dir(name)
    current = _resolve_inside(project_dir, rel_path)
    if not current.is_dir():
        raise NotADirectoryError("Not a folder")
    rel = str(current.relative_to(project_dir)).replace("\\", "/")
    if rel == ".":
        rel = ""
    parts = [p for p in rel.split("/") if p]
    return {
        "name": project_dir.name,
        "folder": f"Projects/{project_dir.name}",
        "path": rel,
        "breadcrumbs": parts,
        "entries": _list_dir(current),
    }


def read_project_file(name: str, rel_path: str) -> dict[str, Any]:
    project_dir = _safe_project_dir(name)
    target = _resolve_inside(project_dir, rel_path)
    if not target.is_file():
        raise FileNotFoundError("File not found")
    rel = str(target.relative_to(project_dir)).replace("\\", "/")
    suffix = target.suffix.lower()
    name_lower = target.name.lower()
    readable = suffix in TEXT_EXTENSIONS or name_lower in {
        "dockerfile",
        "makefile",
        "readme",
        "license",
        "procfile",
        "vagrantfile",
    }
    text = None
    if readable:
        try:
            raw = target.read_text(encoding="utf-8", errors="replace")
            if len(raw) > FULL_TEXT_CHARS:
                text = raw[: FULL_TEXT_CHARS - 1] + "\n\n…(truncated)"
            else:
                text = raw
        except OSError:
            text = None
    try:
        size = target.stat().st_size
    except OSError:
        size = None
    return {
        "name": project_dir.name,
        "path": rel,
        "filename": target.name,
        "size": size,
        "ext": suffix or None,
        "readable": readable and text is not None,
        "text": text,
        "is_markdown": suffix == ".md",
    }
