# Dockerfile

Production image for the Coolify Docker Compose stack. Uses the git build context from Coolify (or `docker compose build`) — no in-image git clone.

## Design choices

| Choice | Reason |
|--------|--------|
| Build context `COPY . .` | Coolify GitHub App / local compose provide the repo |
| `yarn --frozen-lockfile` | Reproducible installs matching `yarn.lock` |
| Port 80 | Coolify Traefik load balancer targets port 80 |
| `docker-entrypoint.sh` | Waits for Postgres, then runs `tsx server.ts` |
| `LIBRARY_SOURCE=r2` | ROM-less container; library seeded from R2 manifest |
| `SAVE_STORAGE=r2` | Save states and SRM in R2 |
| `PROFILE_STORAGE=postgres` | Profiles in compose Postgres service |

## Build locally

```bash
docker compose build
docker compose --env-file .env.coolify up -d
```

Or single-container smoke test:

```bash
docker build -t online-emu .
docker run -p 8080:80 \
  -e R2_ACCOUNT_ID=... \
  -e R2_ACCESS_KEY_ID=... \
  -e R2_SECRET_ACCESS_KEY=... \
  -e R2_BUCKET_NAME=deejpotter \
  -e LIBRARY_SOURCE=r2 \
  -e SAVE_STORAGE=local \
  -e PROFILE_STORAGE=file \
  online-emu
```

Open http://localhost:8080

## Compose stack

See [docker-compose.yml](../docker-compose.yml) — `app` + `postgres` services. Production deploy:

```bash
bash scripts/deploy-coolify-docker.sh
```
