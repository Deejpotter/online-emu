# Coolify Deployment Guide

Deploy online-emu as a Docker Compose stack on Coolify: stateless app container, Postgres for profiles, Cloudflare R2 for ROMs/library/saves.

**Production:** https://roms.deejpotter.com and https://emu.deejpotter.com (same Compose stack, deployed 2026-07-26)

## Architecture

| Data | Storage |
|------|---------|
| ROM files | R2 `roms/*` |
| Game library | R2 `library/manifest.json` |
| User profiles | Postgres (`profiles` table) |
| Save states | R2 `online-emu/saves/{profileId}/{system}/...` |
| SRM (in-game saves) | R2 `online-emu/srm/{profileId}/{system}/...` |
| Metadata cache | Ephemeral (re-seeded from R2 on boot) |

## Prerequisites

- Coolify instance with Docker support
- Cloudflare R2 bucket with ROMs and library manifest uploaded
- Domain with HTTPS (e.g. `roms.deejpotter.com`)

## 1. Upload ROMs and manifest to R2

From a machine with local ROMs (`GAMES_DIR` set in `.env`):

```bash
yarn install
node scripts/scan-library.js
node scripts/upload-to-r2.js
node scripts/upload-manifest.js
node scripts/verify-r2-flow.js --local
```

## 2. Deploy via Docker Compose

### Coolify UI (preferred)

1. **New Resource** → **Application** → **Private Repository (GitHub App)**
2. Repository: `Deejpotter/online-emu`, branch `main`
3. Build pack: **Docker Compose**
4. Compose file: `/docker-compose.yml`
5. Domain: `https://roms.deejpotter.com`
6. Health check: `/api/status`

### Manual deploy (WSL fallback)

Create `.env.coolify` (gitignored) with:

```
POSTGRES_PASSWORD=<generate>
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=deejpotter
LIBRARY_SOURCE=r2
SAVE_STORAGE=r2
PROFILE_STORAGE=postgres
PORT=80
HOSTNAME=0.0.0.0
```

Deploy:

```bash
bash scripts/deploy-coolify-docker.sh
```

This runs `docker compose -f docker-compose.yml -f docker-compose.coolify.yml up -d --build` on the Coolify network with Traefik labels.

### Local compose smoke test

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
docker compose --env-file .env.coolify up -d --build
# App at http://localhost:8080
```

## 3. Environment variables

| Variable | Value | Required |
|----------|-------|----------|
| `PORT` | `80` | Yes |
| `HOSTNAME` | `0.0.0.0` | Yes |
| `LIBRARY_SOURCE` | `r2` | Yes |
| `SAVE_STORAGE` | `r2` | Yes (compose default) |
| `PROFILE_STORAGE` | `postgres` | Yes (compose default) |
| `DATABASE_URL` | `postgres://onlineemu:...@db:5432/onlineemu` | Yes (set in compose) |
| `POSTGRES_PASSWORD` | Secret | Yes |
| `R2_ACCOUNT_ID` | Cloudflare account ID | Yes |
| `R2_ACCESS_KEY_ID` | R2 API token key | Yes |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | Yes |
| `R2_BUCKET_NAME` | e.g. `deejpotter` | Yes |
| `GAMES_DIR` | `/data/games` | Optional (local ROM scan fallback) |

Local dev defaults: `PROFILE_STORAGE=file`, `SAVE_STORAGE=local` (see `jest.env.js`).

## 4. Optional: external drive bind mount

For local ROM fallback and `scanForNewRoms`, bind-mount `H:\Games` (WSL: `/mnt/h/Games`) to `/data/games` in a compose override. R2 remains primary for ROM streaming.

## 5. Migration from single-container deploy

If upgrading from the old manual `docker run` setup:

```bash
# Upload existing saves from old /data volume to R2
node scripts/migrate-saves-to-r2.js --root=/var/lib/docker/volumes/online-emu-data/_data/games

# Import profiles.json into Postgres (if present)
DATABASE_URL=postgres://... node scripts/migrate-profiles-to-postgres.js --file=/path/to/profiles.json
```

## 6. Post-deploy verification

```bash
curl -s https://roms.deejpotter.com/api/status
curl -s https://roms.deejpotter.com/api/systems          # 5 systems
curl -I "https://roms.deejpotter.com/api/roms/GB/ROMs/4-in-1%20Fun%20Pak.zip"  # X-ROM-Source: r2
# After saving: X-Save-Source: r2 on /api/saves/...
```

Browser checklist: [.github/MANUAL-QA.md](../.github/MANUAL-QA.md)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Empty game library | Run `upload-manifest.js`; confirm `LIBRARY_SOURCE=r2` and R2 creds |
| ROM 404 | Run `upload-to-r2.js`; check `X-ROM-Source` header |
| Profiles lost | Check Postgres volume `online-emu_postgres_data`; verify `DATABASE_URL` |
| Saves lost | Confirm `SAVE_STORAGE=r2`; check R2 `online-emu/saves/` prefix |
| Port 80 bind error | Use compose without host port bind; Traefik routes via coolify network |
| Coolify API Unauthenticated | Use `scripts/deploy-coolify-docker.sh` or rotate token in Coolify UI |
| krasus + coolify tunnel conflict | Stop PM2 `onlineemu`; remove roms ingress from krasus config |
