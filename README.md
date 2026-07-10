# Online Emulator

Self-hosted retro game emulator powered by EmulatorJS. Play classic console games in your browser with support for save states, profiles, and PWA installation.

**Live at:** https://roms.deejpotter.com (via Cloudflare Tunnel, runs on DESKTOP-UBV27I5)

## Features

- **Browser-Based Emulation** - EmulatorJS runs entirely in your browser using WebAssembly cores
- **Multi-User Profiles** - Netflix-style profile system to separate saves between users
- **Save States** - Manual save/load states plus automatic in-game saves (SRM)
- **PWA Support** - Install as a native app on any device (mobile, tablet, desktop)
- **Gamepad Support** - Automatic detection of USB/Bluetooth controllers via Browser Gamepad API
- **Offline-Ready** - Service worker caches games and assets for offline play
- **Self-Hosted** - Complete control over your data, no external dependencies

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

### Production Deployment (Local PC via Cloudflare Tunnel)

This project runs on **DESKTOP-UBV27I5** (Windows) and is exposed publicly via Cloudflare Tunnel at `roms.deejpotter.com`.

#### 1. Build and start with PM2

```bash
yarn install
yarn build
pm2 start ecosystem.config.js   # Starts on port 3000
pm2 save                         # Persist across reboots
pm2 startup                      # Enable autostart
```

#### 2. Cloudflare Tunnel

The tunnel is already configured. The relevant ingress rule in `~/.cloudflared/krasus-config.yml`:

```yaml
- hostname: roms.deejpotter.com
  service: http://localhost:3100
```

Tunnel name: `krasus` (shared with other services). Restart the tunnel service after config changes:

```bash
# Check tunnel status
cloudflared tunnel list

# Restart tunnel service (Windows)
Restart-Service cloudflared
```

#### 3. Cloudflare DNS

Add a CNAME record in Cloudflare DNS:
- **Name:** `roms`
- **Target:** `<tunnel-id>.cfargotunnel.com`
- **Proxy:** Enabled (orange cloud)

#### 4. ROMs

Place ROM files in `public/roms/{system}/` — e.g. `public/roms/nes/`, `public/roms/snes/`, etc.

The app scans this directory automatically on startup.

```bash
# ROM directory structure
public/roms/
  nes/
  snes/
  gb/
  gba/
  n64/
```

## Project Structure

```
online-emu/
├── src/
│   ├── app/           # Next.js App Router
│   │   ├── api/       # REST API endpoints
│   │   │   ├── profiles/      # Profile CRUD
│   │   │   ├── saves/         # Save state storage
│   │   │   ├── srm/           # In-game saves
│   │   │   └── games/         # ROM library
│   │   ├── play/      # Emulator page (iframe wrapper)
│   │   └── profiles/  # Profile selection UI
│   ├── lib/           # Utilities
│   │   ├── profiles.ts        # Profile management
│   │   └── game-library.ts    # ROM scanning
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
├── scripts/           # Setup scripts
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

See [.github/todos.md](.github/todos.md) for current development status and roadmap.

## Legal Notice

This project does not include any copyrighted game files. You must provide your own legally obtained ROM files.
