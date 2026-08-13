# Seed data (committed to Git)

JSON files loaded on first setup by `python manage.py seed_db`.

| File | Contents |
|------|----------|
| `cities.json` | 23 cities (Europe, Americas, Middle East, Africa) |
| `regions.json` | 12 country/region bounding boxes |
| `hotels.json` | 21 sample hotels linked to cities |

**Restaurants, cafés, landmarks, and most POIs** come live from **OpenStreetMap** via the Overpass API — no files needed.

After cloning, seeds run automatically via Docker. Manual run:

```bash
docker exec euro-reactv2-django python manage.py seed_db
```

Or locally:

```bash
python manage.py migrate
python manage.py seed_db
```
