#!/bin/bash
# Deploy online-emu to Coolify Docker network with Traefik routing.
# Used when Coolify API token is unavailable; mirrors Coolify-managed labels.
set -euo pipefail

APP_UUID="${APP_UUID:-onlnemuroms0prod0abc12345}"
IMAGE="${IMAGE:-online-emu:latest}"
ENV_FILE="${ENV_FILE:-/mnt/c/Users/Deej/Repos/online-emu/.env.coolify}"
CONTAINER="online-emu-${APP_UUID}"
VOLUME="online-emu-data"
GAMES_MOUNT="${GAMES_MOUNT:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

echo "Building ${IMAGE}..."
docker build -t "$IMAGE" /mnt/c/Users/Deej/Repos/online-emu

docker rm -f "$CONTAINER" 2>/dev/null || true
docker volume create "$VOLUME" >/dev/null 2>&1 || true

RUN_ARGS=(
  -d
  --name "$CONTAINER"
  --network coolify
  --env-file "$ENV_FILE"
  -v "${VOLUME}:/data"
  -v "/mnt/c/Users/Deej/Repos/online-emu/docker-entrypoint.sh:/docker-entrypoint.sh:ro"
  --label "coolify.managed=true"
  --label "coolify.type=application"
  --label "coolify.name=${CONTAINER}"
  --label "traefik.enable=true"
  --label "traefik.http.middlewares.gzip.compress=true"
  --label "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
  --label "traefik.http.routers.http-0-${APP_UUID}.entryPoints=http"
  --label "traefik.http.routers.http-0-${APP_UUID}.middlewares=redirect-to-https"
  --label "traefik.http.routers.http-0-${APP_UUID}.rule=Host(\`roms.deejpotter.com\`) && PathPrefix(\`/\`)"
  --label "traefik.http.routers.http-0-${APP_UUID}.service=http-0-${APP_UUID}"
  --label "traefik.http.routers.https-0-${APP_UUID}.entryPoints=https"
  --label "traefik.http.routers.https-0-${APP_UUID}.middlewares=gzip"
  --label "traefik.http.routers.https-0-${APP_UUID}.rule=Host(\`roms.deejpotter.com\`) && PathPrefix(\`/\`)"
  --label "traefik.http.routers.https-0-${APP_UUID}.service=https-0-${APP_UUID}"
  --label "traefik.http.routers.https-0-${APP_UUID}.tls=true"
  --label "traefik.http.routers.https-0-${APP_UUID}.tls.certresolver=letsencrypt"
  --label "traefik.http.services.http-0-${APP_UUID}.loadbalancer.server.port=80"
  --label "traefik.http.services.https-0-${APP_UUID}.loadbalancer.server.port=80"
)

if [[ -n "$GAMES_MOUNT" && -d "$GAMES_MOUNT" ]]; then
  RUN_ARGS+=(-v "${GAMES_MOUNT}:/data/games:ro")
  echo "Binding games mount: ${GAMES_MOUNT} -> /data/games"
fi

docker run "${RUN_ARGS[@]}" "$IMAGE"

echo "Deployed ${CONTAINER} on network coolify -> https://roms.deejpotter.com"
