"""Path and filename metadata heuristics."""

from __future__ import annotations

import re
from pathlib import PurePosixPath


YEAR_PATTERN = re.compile(r"^(year[_\s-]?(\d+)|y(\d+)|level[_\s-]?(\d+))$", re.I)

DOC_TYPE_KEYWORDS = [
    ("assignment", "Assignment"),
    ("ca1", "Assignment"),
    ("ca2", "Assignment"),
    ("ca3", "Assignment"),
    ("coursework", "Assignment"),
    ("project", "Project"),
    ("dissertation", "Project"),
    ("thesis", "Project"),
    ("lab", "Lab"),
    ("practical", "Lab"),
    ("lecture", "Lecture"),
    ("notes", "Notes"),
    ("tutorial", "Tutorial"),
    ("exam", "Exam"),
    ("revision", "Revision"),
    ("slides", "Slides"),
    ("reading", "Reading"),
]


def _humanize(name: str) -> str:
    name = name.replace("_", " ").replace("-", " ")
    name = re.sub(r"\s+", " ", name).strip()
    return name


def extract_path_metadata(relative_path: str) -> dict[str, str | None]:
    """
    Infer year, module, and document_type from a relative path.

    Example: Year_4/Cloud_Security/Assignments/Cloud_CA2.pdf
    → year=Year 4, module=Cloud Security, document_type=Assignment
    """
    path = PurePosixPath(relative_path.replace("\\", "/"))
    parts = list(path.parts)
    filename = path.name
    stem = path.stem

    year: str | None = None
    module: str | None = None
    document_type: str | None = None

    # Year from first matching folder
    for part in parts[:-1]:
        m = YEAR_PATTERN.match(part.replace(" ", ""))
        if not m:
            m = YEAR_PATTERN.match(part)
        if m or re.match(r"^Year\s*\d+$", part, re.I) or re.match(r"^Y\d+$", part, re.I):
            digits = re.search(r"\d+", part)
            if digits:
                year = f"Year {digits.group()}"
            else:
                year = _humanize(part)
            break
        # Also accept Year1 style without separator
        m2 = re.match(r"^Year(\d+)$", part, re.I)
        if m2:
            year = f"Year {m2.group(1)}"
            break

    # Module: first non-year folder after year, or first folder if no year
    folder_parts = parts[:-1]

    # Projects/<Name>/... → treat project name as module
    if folder_parts and folder_parts[0].lower() in {"projects", "project"}:
        if len(folder_parts) >= 2:
            module = _humanize(folder_parts[1])
            document_type = "Project"
            if year is None:
                year = None
        # Fall through for document_type refinement from filename only

    for i, part in enumerate(folder_parts):
        if module is not None and folder_parts[0].lower() in {
            "projects",
            "project",
        }:
            break
        if year and (
            re.match(r"^Year\s*\d+$", part, re.I)
            or re.match(r"^Year\d+$", part, re.I)
            or re.match(r"^Y\d+$", part, re.I)
        ):
            if i + 1 < len(folder_parts):
                candidate = folder_parts[i + 1]
                # Skip generic content-type folders as module
                if candidate.lower() not in {
                    "assignments",
                    "lectures",
                    "labs",
                    "notes",
                    "projects",
                    "exams",
                    "readings",
                    "tutorials",
                    "slides",
                }:
                    module = _humanize(candidate)
            break
    if module is None and folder_parts:
        # Fallback: deepest meaningful folder that isn't a type folder
        for part in reversed(folder_parts):
            if re.match(r"^Year\d*$", part, re.I) or re.match(r"^Year\s*\d+$", part, re.I):
                continue
            if part.lower() in {
                "assignments",
                "lectures",
                "labs",
                "notes",
                "projects",
                "exams",
                "readings",
                "tutorials",
                "slides",
                "documents",
            }:
                continue
            module = _humanize(part)
            break

    # Document type from folder names
    for part in folder_parts:
        low = part.lower()
        for key, label in DOC_TYPE_KEYWORDS:
            if key in low:
                document_type = label
                break
        if document_type:
            break

    # Document type from filename
    if document_type is None:
        low_name = filename.lower()
        for key, label in DOC_TYPE_KEYWORDS:
            if key in low_name:
                document_type = label
                break

    if document_type is None:
        # Source code by extension
        suffix = path.suffix.lower()
        if suffix in {
            ".py",
            ".java",
            ".js",
            ".jsx",
            ".ts",
            ".tsx",
            ".c",
            ".cpp",
            ".h",
            ".cs",
            ".go",
            ".rs",
            ".kt",
            ".php",
            ".sql",
            ".sh",
        }:
            document_type = "Source Code"
        elif suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}:
            document_type = "Image"
        elif suffix in {".md", ".txt"}:
            document_type = "Notes"
        else:
            document_type = "Document"

    return {
        "year": year,
        "module": module,
        "document_type": document_type,
        "stem": stem,
    }
