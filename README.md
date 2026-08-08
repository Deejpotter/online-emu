# Online Emulator

Self-hosted retro game emulator powered by EmulatorJS. Play classic console games in your browser with support for save states, profiles, and PWA installation.

**Live at:** https://roms.deejpotter.com (Coolify container on DESKTOP-UBV27I5, Cloudflare coolify tunnel, R2-backed library)

## Features

- **Browser-Based Emulation** - EmulatorJS runs entirely in your browser using WebAssembly cores
- **Multi-User Profiles** - Netflix-style profile system to separate saves between users
- **Save States** - Manual save/load states plus automatic in-game saves (SRM)
- **PWA Support** - Install as a native app on any device (mobile, tablet, desktop)
- **Gamepad Support** - Automatic detection of USB/Bluetooth controllers via Browser Gamepad API
- **Offline-Ready** - Service worker caches games and assets for offline play
- **Self-Hosted** - Complete control over your data, no external dependencies

## Deployment Options

### Option A: Coolify + Cloudflare R2 (current production)

Production runs at `roms.deejpotter.com` as a **Docker Compose stack** (app + Postgres) on the Coolify network. ROMs, library, and saves are in Cloudflare R2; profiles are in Postgres.

```bash
# One-time: upload ROMs and manifest to R2
yarn scan:library
yarn upload:roms
yarn upload:manifest
yarn verify:r2
```

Deploy via Coolify UI (Docker Compose build pack) or:

```bash
bash scripts/deploy-coolify-docker.sh
```

Full guide: [docs/COOLIFY.md](docs/COOLIFY.md)

Key env vars (`.env.coolify`):

```
LIBRARY_SOURCE=r2
SAVE_STORAGE=r2
PROFILE_STORAGE=postgres
POSTGRES_PASSWORD=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=deejpotter
PORT=80
```

### Option B: Local PC + PM2 (legacy / dev)

For local-only development with disk-scanned ROMs:

```bash
yarn install
yarn build
pm2 start ecosystem.config.js   # Port 3100
```

Set in `.env`:

```
GAMES_DIR=H:\Games
LIBRARY_SOURCE=local
DATA_DIR=./data
PORT=3100
```

ROMs are scanned from `GAMES_DIR` on startup. PM2 is no longer the primary production host — stop `onlineemu` if it conflicts with the Coolify route.

## Quick Start

### Local Development

Use Yarn for local development. The preferred development workflow is to run the Next.js dev server directly (fast, reliable).

```bash
yarn install         # Installs dependencies + downloads EmulatorJS assets
yarn dev:next        # Start the Next.js dev server (http://localhost:3000)
```

Notes:

- `yarn dev:next` is the recommended, fast dev workflow. It starts the Next.js app directly.
- For production-like behaviour (server initialization, ROM scan), run `yarn build && yarn start`.

### Production Deployment (Coolify)

Production on **DESKTOP-UBV27I5** is served by a Coolify-managed Docker container at `roms.deejpotter.com` via the **coolify** Cloudflare tunnel (not the legacy krasus → PM2 route).

#### 1. Deploy

Preferred: create/update the app in Coolify UI at `https://coolify.deejpotter.com` (Dockerfile build, `/data` volume, env vars above).

Fallback when the Coolify API token is stale:

```bash
bash scripts/deploy-coolify-docker.sh
```

#### 2. Cloudflare Tunnel

`roms.deejpotter.com` routes through the **coolify** tunnel to Traefik → container port 80. Remove any duplicate ingress for this hostname from the legacy `krasus` tunnel config.

#### 3. Post-deploy verification

```bash
curl -s https://roms.deejpotter.com/api/status
curl -s https://roms.deejpotter.com/api/systems   # expect 5 systems
curl -I "https://roms.deejpotter.com/api/roms/GB/ROMs/4-in-1%20Fun%20Pak.zip"   # X-ROM-Source: r2
```

See [.github/MANUAL-QA.md](.github/MANUAL-QA.md) for browser checks.

#### 4. ROMs

ROMs and the library manifest live in Cloudflare R2 (3,744 games across 5 systems). Optional local fallback: bind-mount `H:\Games` (WSL: `/mnt/h/Games`) to `/data/games` when the external drive is connected.

## Project Structure

```
online-emu/
├── src/
│   ├── app/           # Next.js App Router
│   │   ├── api/       # REST API endpoints
│   │   │   ├── profiles/      # Profile CRUD
│   │   │   ├── saves/         # Save state storage
│   │   │   ├── srm/           # In-game saves
│   │   │   ├── roms/          # ROM streaming (R2 + local fallback)
│   │   │   └── games/         # ROM library
│   │   ├── play/      # Emulator page (iframe wrapper)
│   │   └── profiles/  # Profile selection UI
│   ├── lib/           # Utilities
│   │   ├── profiles.ts        # Profile management
│   │   ├── game-library.ts    # ROM scanning
│   │   ├── library-source.ts  # R2 library seeding
│   │   └── r2-client.ts       # Shared R2 helpers
│   ├── middleware.ts          # Profile auth check
│   └── types/         # TypeScript definitions
├── public/
│   ├── emulator.html  # EmulatorJS host (must be in iframe)
│   ├── emulatorjs/    # Self-hosted EmulatorJS assets
│   ├── sw.js          # Service worker
│   └── roms/          # Game files (user-provided)
├── data/              # App data (auto-created)
│   ├── profiles.json       # User profiles
│   └── metadata.json       # Game metadata cache
├── scripts/           # Setup + R2 upload scripts
│   ├── setup-emulatorjs.js
│   ├── scan-library.js
│   ├── seed-library-from-r2.js
│   ├── upload-to-r2.js
│   ├── upload-manifest.js
│   └── verify-r2-flow.js
├── docs/
│   ├── COOLIFY.md          # Coolify deployment guide
│   └── DOCKERFILE.md       # Docker build notes
├── ecosystem.config.js     # PM2 configuration
├── server.ts          # Custom Next.js server
└── .github/
    ├── copilot-instructions.md   # AI coding guidelines
    ├── instructions/             # Path-specific guides
    └── todos.md                  # Development progress
```

## Storage Requirements

Based on typical ROM sizes for a retro collection:

| System | Typical ROM Size | ~100 Games |
|--------|------------------|------------|
| NES | 40-512 KB | ~50 MB |
| SNES | 512 KB - 6 MB | ~200 MB |
| GB/GBC | 32 KB - 2 MB | ~100 MB |
| GBA | 4-32 MB | ~1.5 GB |
| N64 | 8-64 MB | ~3 GB |

Your local PC storage determines capacity — no VPS required.

## Architecture

EmulatorJS **cannot run directly in React** (it tampers with the DOM). We use:

```text
Next.js Page → iframe → emulator.html → EmulatorJS
```

Communication between React and EmulatorJS uses `postMessage`.

## Keyboard Controls

| Key | Action |
|-----|--------|
| Arrow keys | D-Pad |
| Z | A button |
| X | B button |
| A | X button |
| S | Y button |
| Q | L shoulder |
| W | R shoulder |
| Enter | Start |
| Shift | Select |

## Development

See [.github/todos.md](.github/todos.md) for progress and [.github/MANUAL-QA.md](.github/MANUAL-QA.md) for browser verification steps.

## Legal Notice

This project does not include any copyrighted game files. You must provide your own legally obtained ROM files.
