"""Knowledge / projects / modules APIs."""

from __future__ import annotations

from typing import Any
from urllib.parse import unquote

from fastapi import APIRouter, HTTPException, Query

from app.deps import get_db
from app.services.project_catalog import browse_project, list_project_folders, read_project_file

router = APIRouter(tags=["knowledge"])


@router.get("/api/modules")
def modules() -> list[dict[str, Any]]:
    return get_db().list_modules()


@router.get("/api/projects")
def projects() -> list[dict[str, Any]]:
    """Top-level folders under Projects/ (same as /api/project-folders)."""
    return list_project_folders()


@router.get("/api/project-folders")
def project_folders() -> list[dict[str, Any]]:
    """Explicit portfolio folder list — prefer this from the UI."""
    return list_project_folders()


@router.get("/api/projects/{project_name}/browse")
def project_browse(project_name: str, path: str = Query(default="")) -> dict[str, Any]:
    name = unquote(project_name)
    if not name or name == "undefined":
        raise HTTPException(status_code=400, detail="Missing project name")
    try:
        return browse_project(name, path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except NotADirectoryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/projects/{project_name}/file")
def project_file(project_name: str, path: str = Query(...)) -> dict[str, Any]:
    name = unquote(project_name)
    if not name or name == "undefined":
        raise HTTPException(status_code=400, detail="Missing project name")
    try:
        return read_project_file(name, path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/years")
def years() -> list[dict[str, Any]]:
    return get_db().list_years()


@router.get("/api/knowledge")
def knowledge_overview() -> dict[str, Any]:
    db = get_db()
    return {
        "years": db.list_years(),
        "modules": db.list_modules(),
        "projects": list_project_folders(),
        "note": (
            "Projects are browsed from the local Projects/ folder. "
            "Year/module stats come from the indexed library."
        ),
    }
