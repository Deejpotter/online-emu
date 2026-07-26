#!/bin/bash
# Deploy online-emu via Docker Compose on the Coolify network.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.coolify}"
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.coolify.yml)
OLD_CONTAINER="${OLD_CONTAINER:-online-emu-onlnemuroms0prod0abc12345}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env and add POSTGRES_PASSWORD" >&2
  exit 1
fi

cd "$REPO_ROOT"

echo "Stopping legacy manual container if present..."
docker rm -f "$OLD_CONTAINER" 2>/dev/null || true

echo "Building and starting compose stack..."
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" up -d --build

echo "Deployed compose stack -> https://roms.deejpotter.com"
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" ps
