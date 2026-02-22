# Online Emulator

Self-hosted retro game emulator powered by EmulatorJS. Play classic console games in your browser with support for save states, profiles, and PWA installation.

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

- `yarn dev:next` is the recommended, fast dev workflow. It starts the Next.js app directly and is the primary method documented here.
- For production-like behaviour (server initialization, ROM scan), run the production server with `yarn build && yarn start` instead of the dev server.

### Production Deployment (Vultr VPS)

This project is designed to run on a Vultr VPS (Standard plan recommended: $12/mo, 80GB SSD, 4GB RAM).

```bash
# 1. Clone and install
git clone <your-repo-url> online-emu
cd online-emu
yarn install
yarn build

# 2. Create ROMs directory (outside web root)
mkdir -p /root/online-emu/roms

# 3. Configure environment
cp .env.example .env.local
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
├── mobile/            # Deprecated Expo app
└── .github/
   ├── copilot-instructions.md   # AI coding guidelines
   ├── instructions/             # Path-specific guides
   └── todos.md                   # Development progress

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
| Genesis | 512 KB - 4 MB | ~150 MB |
| PSX | 300-700 MB | ~35 GB |
| PSP | 500 MB - 1.5 GB | ~80 GB |

**Vultr Standard Plan (80GB SSD)** easily handles a mixed retro library of 200+ smaller games or 50+ larger PSX/PSP titles.
└── .github/
   ├── copilot-instructions.md   # AI coding guidelines
   ├── instructions/             # Path-specific guides
   └── todos.md                   # Development progress
```

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
│
├── mobile/            # Deprecated Expo app
└── .github/
   ├── copilot-instructions.md   # AI coding guidelines
   ├── instructions/             # Path-specific guides
   └── todos.md                   # Development progress
Based on typical ROM sizes for a retro collection:

| System | Typical ROM Size | ~100 Games |
|--------|------------------|------------|
| NES | 40-512 KB | ~50 MB |
| SNES | 512 KB - 6 MB | ~200 MB |
| GB/GBC | 32 KB - 2 MB | ~100 MB |
| GBA | 4-32 MB | ~1.5 GB |
| N64 | 8-64 MB | ~3 GB |
| Genesis | 512 KB - 4 MB | ~150 MB |
| PSX | 300-700 MB | ~35 GB |
| PSP | 500 MB - 1.5 GB | ~80 GB |

**Vultr Standard Plan (80GB SSD)** easily handles a mixed retro library of 200+ smaller games or 50+ larger PSX/PSP titles.

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
