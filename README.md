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

```bash
cd server
npm install          # Also downloads EmulatorJS automatically
npm run dev          # Starts at http://localhost:3000
```

### Production Deployment (Vultr VPS)

This project is designed to run on a Vultr VPS (Standard plan recommended: $12/mo, 80GB SSD, 4GB RAM).

```bash
# 1. Clone and install
git clone <your-repo-url> online-emu
cd online-emu/server
npm install
npm run build

# 2. Create ROMs directory (outside web root)
mkdir -p /root/online-emu/roms

# 3. Configure environment
cp .env.example .env
# Edit .env and set: GAMES_DIR=/root/online-emu/roms

# 4. Start with PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start

# 5. Upload ROMs via vimms-downloader or SCP
# ROMs go to /root/online-emu/roms/{system}/
```

Visit `http://your-server-ip:3000` to access the app.

### Adding Games

**Development (local):**

```
server/public/roms/
├── nes/           # .nes files
├── snes/          # .sfc, .smc files
└── ...
```

**Production (Vultr):**

```bash
# Recommended: Store ROMs outside web root
mkdir -p /root/online-emu/roms

# Configure in server/.env
GAMES_DIR=/root/online-emu/roms

# Structure:
/root/online-emu/roms/
├── nes/
├── snes/
└── ...
```

The app automatically scans these directories on startup.

## Supported Systems

All systems run using EmulatorJS WebAssembly cores - no external emulators required.

| System | Emulator Core | File Extensions |
|--------|--------------|-----------------|
| NES | FCEUmm | .nes, .fds |
| SNES | Snes9x | .sfc, .smc |
| Game Boy / Color | Gambatte | .gb, .gbc |
| Game Boy Advance | mGBA | .gba |
| N64 | Mupen64Plus | .n64, .z64, .v64 |
| Nintendo DS | DeSmuME | .nds |
| PlayStation | PCSX ReARMed | .bin/.cue, .iso, .chd |
| PSP | PPSSPP | .iso, .cso |
| Sega Genesis | Genesis Plus GX | .md, .bin, .gen |
| Sega Master System | Genesis Plus GX | .sms |
| Sega Game Gear | Genesis Plus GX | .gg |
| Sega CD | Genesis Plus GX | .bin/.cue, .iso |
| Atari 2600 | Stella | .a26, .bin |
| Arcade | MAME 2003 Plus | .zip |

**Note:** PS2 and GameCube are not supported - their emulators (PCSX2/Dolphin) require desktop applications and cannot run in a browser.

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Framework** | Next.js 16 (App Router) + TypeScript |
| **Emulation** | EmulatorJS (WebAssembly/libretro cores) |
| **Profiles** | Local JSON storage (no authentication) |
| **Saves** | Server-side file storage (state + SRM) |
| **PWA** | Service worker for offline support |
| **Deployment** | Vultr VPS + PM2 + Nginx |

## Project Structure

```
online-emu/
├── server/                 # Next.js application
│   ├── src/
│   │   ├── app/           # Next.js App Router
│   │   │   ├── api/       # REST API endpoints
│   │   │   │   ├── profiles/      # Profile CRUD
│   │   │   │   ├── saves/         # Save state storage
│   │   │   │   ├── srm/           # In-game saves
│   │   │   │   └── games/         # ROM library
│   │   │   ├── play/      # Emulator page (iframe wrapper)
│   │   │   └── profiles/  # Profile selection UI
│   │   ├── lib/           # Utilities
│   │   │   ├── profiles.ts        # Profile management
│   │   │   └── game-library.ts    # ROM scanning
│   │   ├── middleware.ts          # Profile auth check
│   │   └── types/         # TypeScript definitions
│   ├── public/
│   │   ├── emulator.html  # EmulatorJS host (must be in iframe)
│   │   ├── emulatorjs/    # Self-hosted EmulatorJS assets
│   │   ├── sw.js          # Service worker
│   │   └── roms/          # Game files (user-provided)
│   ├── data/              # App data (auto-created)
│   │   ├── profiles.json       # User profiles
│   │   └── metadata.json       # Game metadata cache
│   ├── ecosystem.config.js     # PM2 configuration
│   └── server.ts          # Custom Next.js server
│

└── .github/
    ├── copilot-instructions.md   # AI coding guidelines
    ├── instructions/             # Path-specific guides
    └── todos.md                   # Development progress
```

## User Profiles

The app uses a simple local profile system (like Netflix/Plex) - no passwords or authentication required.

- Select or create a profile on first visit
- Profiles separate save files between users
- All data stored locally on the server
- Perfect for family/friend sharing

## Save System

EmulatorJS provides two types of saves:

1. **Save States (`.state`)** - Full memory snapshots for quick save/load
   - Manual saves via UI buttons
   - Stored in `roms/{system}/saves/{profileId}/{game}.state`
   - Auto-saved every 30 seconds as backup

2. **SRM Saves (`.srm`)** - In-game battery/memory card saves  
   - Automatic from game's internal save system
   - Stored in `roms/{system}/saves/{profileId}/{game}.srm`
   - Auto-loaded on game start

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

## Development

See [.github/todos.md](.github/todos.md) for current development status and roadmap.

## Legal Notice

This project does not include any copyrighted game files. You must provide your own legally obtained ROM files.
