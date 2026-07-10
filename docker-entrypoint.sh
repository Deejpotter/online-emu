#!/bin/sh
set -e

# Runs as root. The persistent /data volume is normally mounted by Coolify,
# but if it isn't (local runs), ensure it exists. Chown only the paths the
# nextjs runtime user must write: /data and Next.js' cache dir. A full
# `chown -R /app` is far too slow and blocks startup.
mkdir -p /data /app/.next
chown -R nextjs:nodejs /data 2>/dev/null || true
chown -R nextjs:nodejs /app/.next 2>/dev/null || true

exec su-exec nextjs:nodejs node node_modules/.bin/tsx server.ts
