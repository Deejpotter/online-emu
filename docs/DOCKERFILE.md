# Dockerfile

Self-contained Coolify build. Clones the public repo inside the image because Coolify's dockerfile build-context linking can be unreliable on some homelab setups.

## Design choices

| Choice | Reason |
|--------|--------|
| Git clone in build | Build succeeds even when Coolify's GitHub source linking is broken |
| `yarn --frozen-lockfile` | Reproducible installs matching `yarn.lock` |
| Port 80 | Coolify Traefik load balancer targets port 80 for dockerfile apps |
| `docker-entrypoint.sh` | Creates `/data`, runs server as root to bind port 80 |
| `LIBRARY_SOURCE=r2` | ROM-less container; library seeded from R2 manifest |
| `COPY public/` | EmulatorJS WASM cores and static assets included in image |

## Build locally

```bash
docker build -t online-emu .
docker run -p 8080:80 \
  -e R2_ACCOUNT_ID=... \
  -e R2_ACCESS_KEY_ID=... \
  -e R2_SECRET_ACCESS_KEY=... \
  -e R2_BUCKET_NAME=deejpotter \
  -e LIBRARY_SOURCE=r2 \
  -v online-emu-data:/data \
  online-emu
```

Open http://localhost:8080

## Pin a release

Change the clone branch or tag in the `git clone` line when deploying a specific version:

```dockerfile
RUN git clone --depth 1 --branch v1.0.0 https://github.com/Deejpotter/online-emu.git .
```
