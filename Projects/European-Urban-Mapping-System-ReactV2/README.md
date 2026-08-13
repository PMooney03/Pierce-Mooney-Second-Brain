# Urban Mapping

A location-based mapping app for exploring cities, regions, hotels, restaurants, and OpenStreetMap points of interest across Europe and beyond.

**New in this version:** React (Vite) frontend with PWA support, replacing the original Django/vanilla JS dashboard. Django + PostGIS remain the API backend.

## Features

- **React SPA** — Filter Cities, Proximity, Regions, Hotels, Restaurants, Coffee, Landmarks, All POIs, Saved, Stats
- **PostGIS backend** — spatial queries for cities, regions, and hotels
- **OpenStreetMap** — live POI data (restaurants, cafés, landmarks) via Overpass API
- **PWA** — install on phone home screen
- **Tailscale** — share securely with your tailnet or publicly via Funnel

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 19, Vite, Leaflet, Context API |
| Backend | Django 5, DRF, PostGIS |
| Data | `data/*.json` seeds + OpenStreetMap (live) |
| Runtime | Docker Compose, Nginx, Gunicorn |

## Quick start (clone → run)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```powershell
git clone https://github.com/YOUR_USERNAME/European-Urban-Mapping-System-ReactV2.git
cd European-Urban-Mapping-System-ReactV2
scripts\start-tailscale.bat
```

On first run, Docker will:
1. Build the React app
2. Run database migrations
3. **Load seed data** from `data/cities.json`, `data/regions.json`, `data/hotels.json`
4. Start the app

Open **http://localhost** on your PC, or your Tailscale URL on phone (see `PUBLIC_ACCESS.md`).

## Development

```powershell
# Backend + database
docker compose up -d

# React hot reload
cd frontend
npm install
npm run dev
```

→ http://localhost:5173 (API proxied to Django on :8000)

### Seed data manually

```powershell
docker exec euro-reactv2-django python manage.py seed_db
```

See [`data/README.md`](data/README.md) for what is seeded vs fetched live from OSM.

## Project structure

```
frontend/src/          React app (UI)
data/                  Seed JSON (cities, regions, hotels)
api/                   REST API + Overpass endpoints
cities/ regions/ hotels/  Django models + seed commands
dashboard/spa_views.py Django SPA fallback (production Docker)
docker-compose.yml     PostGIS + Django + Nginx
scripts/               start-tailscale.bat, etc.
PUBLIC_ACCESS.md       Phone access + sharing with others
```

## API

GeoJSON endpoints at `/api/` — cities, regions, hotels, proximity, Overpass POIs.  
Browsable API at `/api/` when `DEBUG=True`.

## Screenshots

See [`screenshots/`](screenshots/) — from the original dashboard; UI is now React with the same capabilities plus Restaurants, Coffee, and richer OSM popups.

## License

Academic / portfolio project. Add a LICENSE file if you open-source formally.
