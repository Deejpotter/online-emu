#!/bin/sh
set -e

# Coolify's Traefik loadbalancer targets port 80, so we listen on 80.
# Running as root lets the server bind port 80 (no CAP_NET_BIND_SERVICE
# juggling needed). The persistent /data volume is mounted by Coolify.
mkdir -p /data /app/.next
chown -R root:root /app 2>/dev/null || true

exec node node_modules/.bin/tsx server.ts
