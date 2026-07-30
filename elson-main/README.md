# Elson — Hassaniya Crowdsourcing Platform

A gamified crowdsourcing platform for building parallel **text + audio** datasets for Mauritania's national languages, starting with **Hassaniya Arabic**. Contributors translate, record, and validate phrases; the best data feeds ASR (speech‑to‑text), MT (translation), and TTS models. An initiative by **ADST** in partnership with **RIM AI**.

---

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Backend** | Express 5, Node.js cluster (multi‑worker), TypeScript |
| **Database** | PostgreSQL 17 + PgBouncer |
| **Reverse proxy** | Caddy 2 (automatic HTTPS) |
| **WhatsApp OTP / bot** | WAHA (WhatsApp HTTP API) |
| **AI features** | OpenAI (transcription, translation, curation) |
| **Infrastructure** | Hetzner (Docker Compose) |

---

## Repository structure

```
hassaniya-crowdsource/
├── src/                        # ── Frontend (Next.js) ──
│   ├── app/                    #   Routes (contribute, validate, reviewer, media-studio, admin…)
│   ├── components/             #   Reusable React components
│   └── lib/                    #   api client, i18n, helpers
├── public/                     # Static assets (incl. _landing.html, served at /)
│
├── backend/                    # ── Backend (Express / TypeScript) ──
│   ├── src/
│   │   ├── routes/             #   HTTP endpoints (auth, phrases, validate, media, reviews, news…)
│   │   ├── services/           #   Business logic (media-ingest, whatsapp, ai-news, email…)
│   │   ├── middleware/         #   auth, security, schedule gates
│   │   ├── utils/              #   tokens, audit, cache, fraud, hassaniya text tools
│   │   ├── scripts/            #   one-off scripts (seeding…)
│   │   └── server.ts           #   Entry point (cluster + Express app)
│   ├── sql/                    #   init.sql + versioned migrations (migration_vNN_*.sql)
│   └── Dockerfile
│
├── deploy/                     # Server setup & deploy scripts, cron helpers
├── docs/                       # Technical docs (evaluation, quality scoring)
│
├── docker-compose.yml          # Full stack (postgres, pgbouncer, backend, frontend, caddy, waha, backups)
├── Dockerfile                  # Frontend (Next.js) image
├── Caddyfile                   # Reverse-proxy / routing
├── next.config.ts
└── .env.example
```

---

## Prerequisites

- **Docker** & **Docker Compose** (recommended path), **or**
- **Node.js ≥ 20** and a local **PostgreSQL 17** for a Docker-free dev setup.

---

## Environment variables

Copy the template and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DB_NAME` | yes | PostgreSQL database name |
| `DB_USER` | yes | PostgreSQL user |
| `DB_PASSWORD` | yes | PostgreSQL password |
| `DB_HOST` | no | DB host (default `postgres` in Docker, `localhost` for local dev) |
| `DB_PORT` | no | DB port (default `5432`) |
| `JWT_SECRET` | yes | Secret used to sign auth tokens (use a long random string) |
| `FRONTEND_URL` | yes | Public frontend origin (e.g. `http://localhost:3000`) — used for CORS |
| `NEXT_PUBLIC_API_URL` | yes | API base URL the frontend calls (build-time) |
| `SEED_FLORES` | no | `true` to seed the FLORES starter dataset on first backend boot |
| `OPENAI_API_KEY` | no | Enables AI features (transcription, translation, news bot) |
| `WAHA_URL` / `WAHA_API_KEY` / `WAHA_SESSION` | no | Enables WhatsApp OTP & bot |

---

## Quick start (Docker — recommended)

Runs the entire stack (Postgres, PgBouncer, backend, frontend, Caddy, WAHA, backups):

```bash
cp .env.example .env      # then edit .env
docker compose up -d --build
```

- `init.sql` runs automatically the **first** time Postgres starts (creates the schema).
- Caddy serves the app on ports **80 / 443**.
- Health check: `curl http://localhost/api/health`
- Logs: `docker compose logs -f backend` (or `frontend`)

---

## Local development (without full Docker)

Run the database in Docker, and the backend + frontend natively for hot reload.

**1. Start a database**

```bash
docker compose up -d postgres        # or use your own local PostgreSQL
```

**2. Backend** — Express, hot reload via `tsx watch`, listens on **:4000**

```bash
cd backend
npm install
cp ../.env .env                      # backend loads .env via dotenv
npm run dev
```

**3. Frontend** — Next.js, listens on **:3000**

```bash
# from the repo root
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > .env.local
npm run dev
```

Open **http://localhost:3000**.

---

## Database & migrations

- **Schema init:** `backend/sql/init.sql` is mounted into Postgres and runs once on first container start.
- **Migrations:** additive, versioned files `backend/sql/migration_vNN_*.sql` (all use `IF NOT EXISTS`, safe to re-run). Apply one against a running stack with:

```bash
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -f - < backend/sql/migration_v73_ingest_source_path.sql
```

- **Seed starter data (FLORES):** set `SEED_FLORES=true` (runs on backend boot) or run manually:

```bash
cd backend && npm run seed
```

---

## Available scripts

**Frontend** (repo root)

| Command | Description |
|---|---|
| `npm run dev` | Next.js dev server (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

**Backend** (`cd backend`)

| Command | Description |
|---|---|
| `npm run dev` | Express with `tsx watch` (hot reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled server (`node dist/server.js`) |
| `npm run seed` | Seed the FLORES starter dataset |
| `npm run lint` | ESLint |

---

## Deployment

Production runs the same `docker-compose.yml` on the server. Deploy **surgically** to avoid downtime on a live competition — never `docker compose down` (it stops Postgres):

```bash
# copy only the changed files to the server, then:
docker compose build backend frontend
docker compose up -d backend frontend    # recreates only these two; the database keeps running
```

Daily database + audio backups run via the `pg-backup` service.

---

## License

Proprietary — © ADST × RIM AI. All rights reserved.
