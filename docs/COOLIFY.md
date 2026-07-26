# Coolify Deployment Guide

Deploy online-emu as a stateless container with ROMs and the game library served from Cloudflare R2. Profiles and saves persist on a Coolify volume mounted at `/data`.

## Prerequisites

- Coolify instance with Docker support
- Cloudflare R2 bucket with ROMs and library manifest uploaded
- Domain (optional) with HTTPS

## 1. Upload ROMs and manifest to R2

From a machine with local ROMs (`GAMES_DIR` set in `.env`):

```bash
yarn install
node scripts/scan-library.js          # scan local disk + prune to 5 systems
node scripts/upload-to-r2.js          # upload ROM files (idempotent)
node scripts/upload-manifest.js       # upload data/metadata.json -> library/manifest.json
node scripts/verify-r2-flow.js --local
```

If ROMs are already in R2 and you only need the manifest:

```bash
node scripts/seed-library-from-r2.js
node scripts/upload-manifest.js
```

## 2. Create the Coolify application

1. **New Resource** → **Application** → **Public Repository**
2. Repository: `https://github.com/Deejpotter/online-emu`
3. Branch: `main`
4. Build pack: **Dockerfile** (uses the repo root `Dockerfile`)

### Why the Dockerfile clones the repo

Coolify's dockerfile build context linking is unreliable on some homelab setups. The Dockerfile clones `main` inside the image so the build succeeds regardless of build-context quirks. Pin the branch in `Dockerfile` when deploying a specific release.

### Port 80 vs 3100

Coolify's Traefik load balancer targets **port 80** for dockerfile apps. The container listens on `PORT=80` via `docker-entrypoint.sh`. Local dev and PM2 still use port **3100**.

## 3. Environment variables

| Variable | Value | Required |
|----------|-------|----------|
| `PORT` | `80` | Yes (default in Dockerfile) |
| `HOSTNAME` | `0.0.0.0` | Yes |
| `LIBRARY_SOURCE` | `r2` | Yes |
| `DATA_DIR` | `/data` | Yes |
| `GAMES_DIR` | `/data/games` | Yes (saves/SRM only; ROMs from R2) |
| `R2_ACCOUNT_ID` | Cloudflare account ID | Yes |
| `R2_ACCESS_KEY_ID` | R2 API token key | Yes |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | Yes |
| `R2_BUCKET_NAME` | e.g. `deejpotter` | Yes |

## 4. Persistent storage

Mount a Coolify volume at container path **`/data`**.

This volume stores:

- `metadata.json` (seeded from R2 on first boot if absent)
- `profiles.json`
- `{system}/saves/{profileId}/` save states and SRM files

Without this volume, profiles and saves are lost on every redeploy.

## 5. Domain and HTTPS

Attach your domain (e.g. `roms.example.com`) in Coolify. COOP/COEP headers for EmulatorJS are configured in `next.config.ts`.

## 6. Post-deploy verification

```bash
# Health check
curl -s https://roms.example.com/api/status | jq .

# Supported systems (should list 5)
curl -s https://roms.example.com/api/systems | jq .

# ROM served from R2 (check response header)
curl -I "https://roms.example.com/api/roms/GB/ROMs/example.zip"
# Expect: X-ROM-Source: r2
```

In the browser:

1. Open `/profiles` and create a profile
2. Pick a game and confirm it loads
3. Save in-game (SRM) and reload — progress should restore
4. Manual save/load state buttons should work

## 7. Local PC alternative

Production can also run on a Windows PC with PM2 + Cloudflare Tunnel (`LIBRARY_SOURCE=local`, `GAMES_DIR=H:\Games`). See [README.md](../README.md) for that path.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Empty game library | Run `upload-manifest.js`; confirm `LIBRARY_SOURCE=r2` and R2 creds |
| ROM 404 | Run `upload-to-r2.js`; check `X-ROM-Source` header |
| Saves lost after redeploy | Mount `/data` volume |
| Build fails on yarn | Ensure `yarn.lock` is committed; Dockerfile uses `yarn --frozen-lockfile` |
