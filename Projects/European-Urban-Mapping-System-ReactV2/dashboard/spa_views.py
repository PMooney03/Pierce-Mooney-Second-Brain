import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404


def _safe_path(base: Path, relative: str) -> Path:
    target = (base / relative).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise Http404('Invalid path')
    return target


def serve_spa(request, path=''):
    base = settings.FRONTEND_DIST
    if not base.exists():
        raise Http404('Frontend not built')

    clean = path.lstrip('/')
    if clean:
        candidate = _safe_path(base, clean)
        if candidate.is_file():
            content_type, _ = mimetypes.guess_type(str(candidate))
            return FileResponse(candidate.open('rb'), content_type=content_type)

    index = base / 'index.html'
    if not index.is_file():
        raise Http404('index.html missing')
    return FileResponse(index.open('rb'), content_type='text/html')
