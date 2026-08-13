# Network Operations Dashboard

Learning project: simulated network device monitoring with Java/Spring Boot, React/TypeScript, PostgreSQL, Docker, and CI/CD.

## Current status

**Stage 4 complete** — React frontend (dark mode by default) + backend API + tests.

Still to come: frontend tests, full Docker images, GitHub Actions.

## Prerequisites

- JDK 21+ (JDK 25 works; project compiles to Java 21)
- Node.js 20+ and npm
- Docker Desktop (for local PostgreSQL)
- Maven Wrapper (`backend/mvnw.cmd`)

## Stage 4 — run the full local UI

### 1. Start PostgreSQL

```powershell
cd C:\Users\pierc\Desktop\NetworkOpsDashboard
docker compose up -d postgres
```

### 2. Start the backend (terminal 1)

```powershell
cd C:\Users\pierc\Desktop\NetworkOpsDashboard\backend
.\mvnw.cmd spring-boot:run
```

### 3. Start the frontend (terminal 2)

```powershell
cd C:\Users\pierc\Desktop\NetworkOpsDashboard\frontend
npm run dev
```

Open **http://localhost:5173**

- UI defaults to **dark mode** (toggle in the top bar)
- Vite proxies `/api` to `http://localhost:8080`

### Frontend features

- Dashboard summary (totals, online/offline/degraded, average response time)
- Device list with status and type filters
- Add / edit / delete devices
- Device detail + status history
- Form validation and API error display

## Stage 3 — run backend tests

```powershell
cd C:\Users\pierc\Desktop\NetworkOpsDashboard
docker compose up -d postgres
cd backend
.\mvnw.cmd test
```

## Stage 2 — API only

- Health: http://localhost:8080/actuator/health
- Swagger: http://localhost:8080/swagger-ui.html

## Environments

| Environment | How | Database |
|---|---|---|
| Development | Local + Docker Compose Postgres | Local volume `networkops_postgres_data` |
| Staging | Later: deploy from `develop` | Separate staging DB + secrets |
| Production | Later: deploy from `main` + approval | Separate production DB + secrets |

No passwords or cloud secrets are stored in Git. See `.env.example`.

## Future improvements

- Authentication / authorisation
- Stronger visual brand polish
- Optional free hosting (Render / Railway / similar)
