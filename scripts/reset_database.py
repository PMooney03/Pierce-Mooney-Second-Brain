#!/usr/bin/env python3
"""Reset local SQLite + Qdrant indexes (does NOT touch college files)."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.config import get_settings  # noqa: E402
from app.logging_config import setup_logging  # noqa: E402


def main() -> int:
    setup_logging()
    settings = get_settings()
    sqlite_path = settings.resolve_sqlite_path()
    qdrant_path = settings.resolve_qdrant_path()

    print("This will DELETE local indexes only.")
    print(f"  SQLite: {sqlite_path}")
    print(f"  Qdrant: {qdrant_path}")
    print("College documents will NOT be modified.")

    if sqlite_path.exists():
        sqlite_path.unlink()
        print(f"Removed {sqlite_path}")
    for suffix in ("-wal", "-shm"):
        side = Path(str(sqlite_path) + suffix)
        if side.exists():
            side.unlink()

    if qdrant_path.exists():
        shutil.rmtree(qdrant_path)
        qdrant_path.mkdir(parents=True, exist_ok=True)
        print(f"Cleared {qdrant_path}")

    print("Done. Run: python scripts/ingest.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
