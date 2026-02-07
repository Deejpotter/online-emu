#!/usr/bin/env bash
# Usage:
#  COOLIFY_API="http://67.219.108.61:8000/api/v1" \
#  COOLIFY_TOKEN="3|..." \
#  PROJECT_UUID="..." \
#  SERVER_UUID="..." \
#  GITHUB_APP_UUID="..." \
#  REPO="Deejpotter/online-emu" \
#  BRANCH="main" \
#  ./scripts/setup-coolify-app.sh

set -euo pipefail

: ${COOLIFY_API:?Need COOLIFY_API}
: ${COOLIFY_TOKEN:?Need COOLIFY_TOKEN}
: ${PROJECT_UUID:?Need PROJECT_UUID}
: ${SERVER_UUID:?Need SERVER_UUID}
: ${GITHUB_APP_UUID:?Need GITHUB_APP_UUID}
: ${REPO:?Need REPO}
: ${BRANCH:=main}

echo "Creating application resource in Coolify..."

payload=$(jq -n \
  --arg project_uuid "$PROJECT_UUID" \
  --arg server_uuid "$SERVER_UUID" \
  --arg env_name "production" \
  --arg github_app_uuid "$GITHUB_APP_UUID" \
  --arg repo "$REPO" \
  --arg branch "$BRANCH" \
  --arg build_pack "docker-compose" \
  --arg base_directory "server" \
  --arg docker_compose_location "server/docker-compose.yml" \
  --arg ports_exposes "3000:3000" \
  --arg name "online-emu" \
  --arg domains "" \
  '{project_uuid: $project_uuid, server_uuid: $server_uuid, environment_name: $env_name, github_app_uuid: $github_app_uuid, git_repository: $repo, git_branch: $branch, build_pack: $build_pack, base_directory: $base_directory, docker_compose_location: $docker_compose_location, ports_exposes: $ports_exposes, name: $name, domains: $domains, is_auto_deploy_enabled: true, is_force_https_enabled: false, is_static: false}')

echo "Payload: $payload"

resp=$(curl -sS -X POST "$COOLIFY_API/applications/private-github-app" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$payload")

echo "Response: $resp"

app_uuid=$(echo "$resp" | jq -r '.uuid // .id // empty')
if [ -z "$app_uuid" ]; then
  echo "Error: did not receive application uuid. Response: $resp" >&2
  exit 1
fi

echo "Application created with UUID: $app_uuid"

echo "Configuring environment variables..."
# set envs
jq -n \
  --arg name1 "GAMES_DIR" --arg value1 "/app/public/roms" \
  --arg name2 "DATA_DIR" --arg value2 "/app/data" \
  --arg name3 "NODE_ENV" --arg value3 "production" \
  --arg name4 "PORT" --arg value4 "3000" \
  '[{name:$name1,value:$value1,scope:"env"},{name:$name2,value:$value2,scope:"env"},{name:$name3,value:$value3,scope:"env"},{name:$name4,value:$value4,scope:"env"}]' > /tmp/envs.json

curl -sS -X POST "$COOLIFY_API/applications/$app_uuid/envs" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/envs.json

echo "Configuring mounts (persistent storages)..."
# create mounts via application update with docker_compose_domains or special fields if available
# NOTE: If the API provides a mounts endpoint, use that. Here we'll attempt to patch the application with mount configuration fields.

mounts_payload=$(jq -n \
  --arg app_uuid "$app_uuid" \
  '{volumes: [{host_path: "/srv/roms", container_path: "/app/public/roms", read_only: true}, {host_path: "/srv/online-emu-data", container_path: "/app/data", read_only: false}] }')

curl -sS -X PATCH "$COOLIFY_API/applications/$app_uuid" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$mounts_payload" || true

echo "Triggering deployment..."
curl -sS -X POST "$COOLIFY_API/applications/$app_uuid/deploy?type=manual" \
  -H "Authorization: Bearer $COOLIFY_TOKEN"

echo "Done. Check Coolify UI for build logs and health status." 
