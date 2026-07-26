#!/bin/sh
set -e

mkdir -p /data

# Wait for Postgres when PROFILE_STORAGE=postgres
if [ "${PROFILE_STORAGE:-file}" = "postgres" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "[Entrypoint] Waiting for Postgres..."
  node -e "
    const url = new URL(process.env.DATABASE_URL.replace('postgres://', 'http://'));
    const host = url.hostname;
    const port = url.port || 5432;
    const net = require('net');
    (async () => {
      for (let i = 0; i < 60; i++) {
        try {
          await new Promise((resolve, reject) => {
            const s = net.createConnection({ host, port: Number(port) }, () => { s.end(); resolve(); });
            s.on('error', reject);
          });
          console.log('[Entrypoint] Postgres is ready');
          process.exit(0);
        } catch {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      console.error('[Entrypoint] Postgres not ready after 60s');
      process.exit(1);
    })();
  "
fi

exec node node_modules/.bin/tsx server.ts
