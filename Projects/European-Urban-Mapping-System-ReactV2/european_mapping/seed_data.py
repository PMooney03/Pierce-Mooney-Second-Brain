import json
from pathlib import Path

from django.conf import settings

DATA_DIR = Path(settings.BASE_DIR) / 'data'


def load_seed_json(filename):
    path = DATA_DIR / filename
    if not path.is_file():
        raise FileNotFoundError(f'Seed data file missing: {path}')
    with path.open(encoding='utf-8') as handle:
        return json.load(handle)
