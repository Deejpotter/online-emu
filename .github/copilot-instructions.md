# Online Emulator - AI Coding Instructions

## Project Overview

Self-hosted retro game emulator powered by EmulatorJS, designed for deployment on a Vultr VPS.

**Architecture**: Browser-based emulation with local user profiles and server-side save storage.

- **EmulatorJS**: WebAssembly-based emulation cores run entirely in the browser (NES, SNES, GB, GBA, N64, PSX, PSP, Genesis, Arcade)
- **Next.js 16**: Server framework with App Router, hosting ROMs and managing saves/profiles
- **No External Dependencies**: No cloud storage, no streaming, no external emulators - fully self-contained
- **PWA-Ready**: Installable as a native app on any device with offline support

## ⚠️ CRITICAL: EmulatorJS + React/Next.js Integration

**EmulatorJS CANNOT run directly in React components.** Per official docs:

> "To embed within React or a SPA, the only way is to embed an iframe into your page. You cannot run it directly on the page. This will break single page apps, and tamper with the DOM."

### Correct Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Next.js App (React)                                         │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ /play page (React Component)                        │   │
│   │                                                     │   │
│   │   ┌─────────────────────────────────────────────┐   │   │
│   │   │ <iframe src="/emulator.html?game=...">      │   │   │
│   │   │                                             │   │   │
│   │   │   ┌─────────────────────────────────────┐   │   │   │
│   │   │   │ EmulatorJS (runs in isolation)      │   │   │   │
│   │   │   │ - Loads ROMs                        │   │   │   │
│   │   │   │ - Runs WebAssembly cores            │   │   │   │
│   │   │   │ - Renders to <canvas>               │   │   │   │
│   │   │   └─────────────────────────────────────┘   │   │   │
│   │   │                                             │   │   │
│   │   └─────────────────────────────────────────────┘   │   │
│   │                                                     │   │
│   │   Communication via postMessage API                 │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

- `/public/emulator.html` - Static HTML page that hosts EmulatorJS
- `/src/app/play/page.tsx` - React page with iframe wrapper

### ⚠️ EmulatorJS Server Requirements

EmulatorJS WASM cores require specific HTTP headers for SharedArrayBuffer:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

These headers are configured in `next.config.ts`. Without them, WASM cores fail with "SharedArrayBuffer is not defined".

**CRITICAL**: These headers only work on:

- `localhost` (trusted origin)
- HTTPS connections

Using a LAN IP like `10.0.0.13` will cause headers to be ignored! Always test via `localhost:3000` or deploy with proper HTTPS.

**Important**: `EJS_startOnLoaded` behavior depends on the `autoStart` URL parameter. When a user clicks a game card (user gesture), we pass `autoStart=true` to the iframe, enabling auto-play. Without user gesture, browsers block audio/video autoplay.

**Important**: Do NOT set `EJS_defaultControls = true`. This causes a crash. Either omit it entirely or provide a full control mapping object.

### Auto-Start Flow

When users click a game from the library, the game starts automatically:

```
1. User clicks GameCard → user gesture captured
2. page.tsx navigates with ?autoStart=true
3. EmulatorContent.tsx passes autoStart to iframe URL
4. emulator.html sets EJS_startOnLoaded = true
5. EmulatorJS starts immediately (user gesture satisfies autoplay policy)
```

### Responsive Scaling

The emulator canvas scales responsively while maintaining aspect ratio:

```css
/* Container fills available space */
.emulator-container {
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	height: 100%;
}

/* Canvas scales within container, maintains aspect ratio */
#game {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
}
```

### Gamepad/Controller Support

EmulatorJS automatically detects gamepads via the Browser Gamepad API:

- **Analog sticks**: Auto-mapped for systems that support them (N64, PSX)
- **Grayed options**: Intentional—EmulatorJS handles stick mapping internally
- **Touchpads**: Won't work as gamepads (different HID device class)
- **USB/Bluetooth**: Both supported, plug and play

### EmulatorJS Save System

EmulatorJS has TWO types of saves. Both are stored on the server, namespaced by profile ID:

#### 1. Save States (.state) - MANUAL

Full emulator memory snapshots. Used for "quick save/load" anywhere.

**Storage**: `{gamesDir}/{system}/saves/{profileId}/{gameName}.state`

**API Endpoints** (`/api/saves/[gameId]/route.ts`):

- `GET /api/saves/{gameId}?system={system}&slot={slot}` - Load save state
- `POST /api/saves/{gameId}?system={system}&slot={slot}` - Save state (binary body)
- `DELETE /api/saves/{gameId}?system={system}&slot={slot}` - Delete save state

**Authentication**: Requires `profileId` cookie. Returns 401 if not set.

**Migration**: On GET, if no save exists in profile directory, checks legacy path
`{gamesDir}/{system}/saves/{gameName}.state`. Legacy saves are read but new saves
always go to the profile-specific directory.

**How It Works**:

- `saveToServer(slot)` - Uses `gameManager.getState()` to get state data
- `loadFromServer(slot)` - Uses `gameManager.loadState(data)` to restore
- Triggered via UI buttons (Save/Load State) or postMessage commands
- Auto-saves to server every 30 seconds as backup
- **NOT auto-loaded on game start** (user must manually load)

#### 2. SRM Saves (.srm) - AUTOMATIC

In-game battery/memory card saves. The game's internal save system.

**Storage**: `{gamesDir}/{system}/saves/{profileId}/{gameName}.srm`

**API Endpoints** (`/api/srm/[gameId]/route.ts`):

- `GET /api/srm/{gameId}?system={system}` - Load SRM file
- `POST /api/srm/{gameId}?system={system}` - Save SRM file (binary body)
- `DELETE /api/srm/{gameId}?system={system}` - Delete SRM file

**Authentication**: Requires `profileId` cookie. Returns 401 if not set.

**Migration**: Same as save states - checks legacy path on GET, but writes to profile dir.

**How It Works**:

- `saveSrmToServer()` - Uses `gameManager.getSaveFile()` to get SRM data
- `loadSrmFromServer()` - Writes SRM to virtual filesystem, calls `loadSaveFiles()`
- **Auto-loaded on game start** (restores in-game save files)
- Auto-saves every 30 seconds while playing
- Saves on tab switch, window blur, and page hide

**Key Difference**:

- Save states = ONE snapshot (our slot param manages multiple)
- SRM saves = Game's internal saves (game manages multiple files)

**Key Configuration** (in `emulator.html`):

```javascript
window.EJS_gameName = "GameName"; // CRITICAL: Save file identifier
window.EJS_fixedSaveInterval = 5000; // IndexedDB fallback flush interval
```

### Communication Pattern

```typescript
// Parent (React) → iframe (EmulatorJS)
iframeRef.current.contentWindow.postMessage(
	{ type: "input", button: "A", pressed: true },
	"*"
);

// iframe (EmulatorJS) → Parent (React)
window.parent.postMessage({ type: "ready", canvas: canvasElement }, "*");
```

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **User Profiles**: Simple local profiles (no authentication required)
- **Emulation**: EmulatorJS (self-hosted, runs in iframe, WebAssembly cores)
- **PWA**: Service worker for offline support, installable on all devices
- **Deployment**: Vultr VPS (Standard plan: $12/mo, 80GB SSD, 4GB RAM)
- **Process Manager**: PM2 for production process management
- **Reverse Proxy**: Nginx (recommended for SSL/domain routing)

## Supported Systems

All systems use EmulatorJS browser-based cores. **PS2 and GameCube are NOT supported** - they require desktop emulators (PCSX2/Dolphin) that cannot run in browsers.

| System             | Core            | Extensions            |
| ------------------ | --------------- | --------------------- |
| NES                | FCEUmm          | .nes, .fds            |
| SNES               | Snes9x          | .sfc, .smc            |
| Game Boy / Color   | Gambatte        | .gb, .gbc             |
| Game Boy Advance   | mGBA            | .gba                  |
| N64                | Mupen64Plus     | .n64, .z64, .v64      |
| Nintendo DS        | DeSmuME         | .nds                  |
| PlayStation        | PCSX ReARMed    | .bin/.cue, .iso, .chd |
| PSP                | PPSSPP          | .iso, .cso            |
| Sega Genesis       | Genesis Plus GX | .md, .bin, .gen       |
| Sega Master System | Genesis Plus GX | .sms                  |
| Sega Game Gear     | Genesis Plus GX | .gg                   |
| Sega CD            | Genesis Plus GX | .bin/.cue, .iso       |
| Atari 2600         | Stella          | .a26, .bin            |
| Arcade             | MAME 2003 Plus  | .zip                  |

## User Profiles

The app uses a simple local profile system (like Netflix/Plex) to identify users.
No passwords or authentication - just select or create a profile to start playing.

### Why Local Profiles Over Authentication

- **Zero setup** - No OAuth credentials or external services needed
- **Works completely offline** - Perfect for LAN/local use
- **Shareable** - Others can clone the project and use it immediately
- **Simple** - Just names to separate save files between users

### How It Works

1. First visit → Redirected to `/profiles`
2. User creates or selects a profile
3. Profile ID stored in cookie (`profileId`)
4. Middleware checks cookie on every request
5. Profile ID used to namespace save files

### Key Files

- `src/lib/profiles.ts` - Server-side CRUD for profiles
- `src/middleware.ts` - Redirects to /profiles if no profile selected
- `src/app/profiles/page.tsx` - Profile selection UI
- `src/app/api/profiles/route.ts` - List/create profiles API
- `src/app/api/profiles/[id]/route.ts` - Get/update/delete profile API
- `data/profiles.json` - Profile storage (auto-created)

### Profile Data Structure

```typescript
interface Profile {
	id: string; // UUID
	name: string; // Display name
	avatar?: string; // Emoji avatar (default: 👤)
	createdAt: string; // ISO timestamp
}
```

### Storage Locations

- **Profiles**: `data/profiles.json`
- **Save States**: `roms/{system}/saves/{profileId}/{gameName}.state`
- **SRM Saves**: `roms/{system}/saves/{profileId}/{gameName}.srm`

**Directory Structure Example**:

```
roms/
├── n64/
│   ├── Super Mario 64.z64
│   └── saves/
│       ├── abc-123-uuid/              # John's profile
│       │   ├── Super Mario 64.state   # John's save state
│       │   └── Super Mario 64.srm     # John's in-game saves
│       └── def-456-uuid/              # Sarah's profile
│           ├── Super Mario 64.state
│           └── Super Mario 64.srm
└── snes/
    ├── Super Metroid.sfc
    └── saves/
        └── abc-123-uuid/
            └── Super Metroid.srm
```

## PWA (Progressive Web App)

The server hosts a PWA that can be installed on any device (mobile, tablet, desktop).

### Why PWA Over Native App?

The original Expo mobile app was deprecated because it was redundant - it just opened a WebView to the server anyway. PWA provides:

1. **Single codebase** - No separate mobile app to maintain
2. **Same EmulatorJS experience** - Works identically on all devices
3. **Native gamepad support** - Browser Gamepad API works across platforms
4. **Works on iOS, Android, and desktop** - Universal compatibility

### Installation

1. Open the server URL in Chrome/Safari on mobile
2. Tap "Add to Home Screen" in browser menu
3. App installs with offline support

### Key Files

- `public/sw.js` - Service worker for offline support
- `src/app/manifest.ts` - PWA manifest (name, icons, theme)
- `scripts/generate-icons.js` - Auto-generates PWA icons

## Coding Guidelines

### TypeScript Conventions

- Use strict TypeScript (`strict: true` in tsconfig)
- Prefer `interface` over `type` for object shapes
- Use barrel exports (`index.ts`) for clean imports
- Name files: `kebab-case.ts` for utilities, `PascalCase.tsx` for components

### Component Patterns

```tsx
// Server: src/app/components/GameCard.tsx
export function GameCard({ game, onSelect }: GameCardProps) { ... }
```

## Project Structure

```text
online-emu/
├── server/                 # Next.js application
│   ├── src/
│   │   ├── app/           # App Router pages & API
│   │   │   ├── api/       # REST endpoints
│   │   │   │   ├── profiles/  # Profile CRUD API
│   │   │   │   ├── saves/     # Save state API
│   │   │   │   ├── srm/       # SRM saves API
│   │   │   │   ├── games/     # ROM library API
│   │   │   │   └── systems/   # Available systems API
│   │   │   ├── profiles/  # Profile selection page
│   │   │   ├── play/      # Emulator page (iframe wrapper)
│   │   │   └── components/ # React components
│   │   ├── lib/           # Utilities
│   │   │   ├── profiles.ts        # Profile storage functions
│   │   │   └── game-library.ts    # ROM scanning logic
│   │   ├── middleware.ts  # Profile check & routing
│   │   └── types/         # TypeScript definitions
│   ├── data/              # App data (auto-created)
│   │   ├── profiles.json       # User profiles storage
│   │   └── metadata.json       # Game metadata cache
│   ├── public/
│   │   ├── emulator.html  # ⚠️ Static HTML hosting EmulatorJS (NOT React)
│   │   ├── emulatorjs/    # Self-hosted EmulatorJS data
│   │   ├── sw.js          # Service worker for PWA offline support
│   │   └── roms/          # ROM files by system
│   ├── scripts/           # Setup scripts (including icon generation)
│   ├── ecosystem.config.js # PM2 production configuration
│   ├── .env.example       # Environment variables template
│   └── server.ts          # Custom Next.js server
│
└── .github/
    ├── copilot-instructions.md  # This file
    ├── instructions/            # Path-specific instructions
    └── todos.md                 # Development progress
```

## Key Commands

```bash
# Local Development
cd server && npm install      # Installs deps + downloads EmulatorJS
cd server && npm run dev      # Start dev server (localhost:3000)
cd server && npm run build    # Build for production

# Production Deployment (Vultr VPS)
cd server && npm install      # Install dependencies
cd server && npm run build    # Build production bundle
npm install -g pm2            # Install PM2 globally
pm2 start ecosystem.config.js # Start with PM2
pm2 save                      # Save PM2 process list
pm2 startup                   # Enable auto-start on boot

# PWA Installation
# 1. Open localhost:3000 (dev) or http://your-server-ip:3000 (prod) in mobile browser
# 2. Tap "Add to Home Screen" in Chrome/Safari menu
# 3. App installs with offline support
```

## Deployment Strategy (Vultr VPS)

**Recommended Plan**: Standard ($12/mo)

- 80GB SSD Storage
- 4GB RAM
- 3TB Monthly Bandwidth
- Sufficient for 200+ retro games or 50+ PSX/PSP titles

**Setup Overview**:

1. Clone repo and install dependencies
2. Upload ROMs to `public/roms/{system}/`
3. Build production bundle (`npm run build`)
4. Start with PM2 for process management
5. Configure Nginx reverse proxy (optional, for SSL/domain)
6. Set up SSL with Let's Encrypt (recommended for HTTPS)

## Resources

- [EmulatorJS Docs](https://emulatorjs.org/docs)
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Vultr Docs](https://www.vultr.com/docs/)
- [PM2 Guide](https://pm2.keymetrics.io/docs/usage/quick-start/)

## AI Agent Workflow

1. Read `.github/todos.md` for current tasks and progress
2. Check path-specific instructions in `.github/instructions/`
3. Use Context7 MCP for library documentation before implementing
4. Preserve existing code; add comments explaining WHY, not WHAT
5. Update todos.md status after completing tasks

When users click a game from the library, the game starts automatically:

```
1. User clicks GameCard → user gesture captured
2. page.tsx navigates with ?autoStart=true
3. EmulatorContent.tsx passes autoStart to iframe URL
4. emulator.html sets EJS_startOnLoaded = true
5. EmulatorJS starts immediately (user gesture satisfies autoplay policy)
```

### Responsive Scaling

The emulator canvas scales responsively while maintaining aspect ratio:

```css
/* Container fills available space */
.emulator-container {
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	height: 100%;
}

/* Canvas scales within container, maintains aspect ratio */
#game {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
}
```

### Gamepad/Controller Support

EmulatorJS automatically detects gamepads via the Browser Gamepad API:

- **Analog sticks**: Auto-mapped for systems that support them (N64, PSX)
- **Grayed options**: Intentional—EmulatorJS handles stick mapping internally
- **Touchpads**: Won't work as gamepads (different HID device class)
- **USB/Bluetooth**: Both supported, plug and play

### EmulatorJS Save System

EmulatorJS has TWO types of saves. Both are stored on the server, namespaced by profile ID:

#### 1. Save States (.state) - MANUAL

Full emulator memory snapshots. Used for "quick save/load" anywhere.

**Storage**: `{gamesDir}/{system}/saves/{profileId}/{gameName}.state`

**API Endpoints** (`/api/saves/[gameId]/route.ts`):

- `GET /api/saves/{gameId}?system={system}&slot={slot}` - Load save state
- `POST /api/saves/{gameId}?system={system}&slot={slot}` - Save state (binary body)
- `DELETE /api/saves/{gameId}?system={system}&slot={slot}` - Delete save state

**Authentication**: Requires `profileId` cookie. Returns 401 if not set.

**Migration**: On GET, if no save exists in profile directory, checks legacy path
`{gamesDir}/{system}/saves/{gameName}.state`. Legacy saves are read but new saves
always go to the profile-specific directory.

**How It Works**:

- `saveToServer(slot)` - Uses `gameManager.getState()` to get state data
- `loadFromServer(slot)` - Uses `gameManager.loadState(data)` to restore
- Triggered via UI buttons (Save/Load State) or postMessage commands
- Auto-saves to server every 30 seconds as backup
- **NOT auto-loaded on game start** (user must manually load)

#### 2. SRM Saves (.srm) - AUTOMATIC

In-game battery/memory card saves. The game's internal save system.

**Storage**: `{gamesDir}/{system}/saves/{profileId}/{gameName}.srm`

**API Endpoints** (`/api/srm/[gameId]/route.ts`):

- `GET /api/srm/{gameId}?system={system}` - Load SRM file
- `POST /api/srm/{gameId}?system={system}` - Save SRM file (binary body)
- `DELETE /api/srm/{gameId}?system={system}` - Delete SRM file

**Authentication**: Requires `profileId` cookie. Returns 401 if not set.

**Migration**: Same as save states - checks legacy path on GET, but writes to profile dir.

**How It Works**:

- `saveSrmToServer()` - Uses `gameManager.getSaveFile()` to get SRM data
- `loadSrmFromServer()` - Writes SRM to virtual filesystem, calls `loadSaveFiles()`
- **Auto-loaded on game start** (restores in-game save files)
- Auto-saves every 30 seconds while playing
- Saves on tab switch, window blur, and page hide

**Key Difference**:

- Save states = ONE snapshot (our slot param manages multiple)
- SRM saves = Game's internal saves (game manages multiple files)

**Key Configuration** (in `emulator.html`):

```javascript
window.EJS_gameName = "GameName"; // CRITICAL: Save file identifier
window.EJS_fixedSaveInterval = 5000; // IndexedDB fallback flush interval
```

### Communication Pattern

```typescript
// Parent (React) → iframe (EmulatorJS)
iframeRef.current.contentWindow.postMessage(
	{ type: "input", button: "A", pressed: true },
	"*"
);

// iframe (EmulatorJS) → Parent (React)
window.parent.postMessage({ type: "ready", canvas: canvasElement }, "*");
```

## Tech Stack

### Server (PC)

- **Framework**: Next.js 16 (App Router) with TypeScript
- **User Profiles**: Simple local profiles (no authentication required)
- **Emulation**: EmulatorJS (self-hosted, runs in iframe)
- **External Emulators**: PCSX2/Dolphin for PS2/GameCube (launches on PC)
- **Real-time**: Socket.IO 4.8 for controller inputs
- **Streaming**: WebRTC via simple-peer (canvas capture)
- **Discovery**: bonjour-service (mDNS)
- **PWA**: Installable web app with offline support

## External Emulators (PS2/GameCube)

PS2 and GameCube games require desktop emulators (PCSX2/Dolphin) that run on the PC.
These games launch in a separate window - they don't stream to the browser.

### How It Works

1. Configure emulator paths in Settings page
2. PS2/GC games show "🖥️ PC" badge in library
3. Clicking launches the game in PCSX2/Dolphin on the PC monitor

### Key Files

- `src/lib/emulator-config.ts` - Emulator path configuration
- `src/lib/emulator-launcher.ts` - Launch emulators via command line
- `src/app/api/config/emulators/route.ts` - Config API
- `src/app/settings/page.tsx` - Settings UI
- `data/emulator-config.json` - Stored paths

## User Profiles

The app uses a simple local profile system (like Netflix/Plex) to identify users.
No passwords or authentication - just select or create a profile to start playing.

### Why Local Profiles Over Authentication

- **Zero setup** - No OAuth credentials or external services needed
- **Works completely offline** - Perfect for LAN/local use
- **Shareable** - Others can clone the project and use it immediately
- **Simple** - Just names to separate save files between users

### How It Works

1. First visit → Redirected to `/profiles`
2. User creates or selects a profile
3. Profile ID stored in cookie (`profileId`)
4. Middleware checks cookie on every request
5. Profile ID used to namespace save files

### Key Files

- `src/lib/profiles.ts` - Server-side CRUD for profiles
- `src/middleware.ts` - Redirects to /profiles if no profile selected
- `src/app/profiles/page.tsx` - Profile selection UI
- `src/app/api/profiles/route.ts` - List/create profiles API
- `src/app/api/profiles/[id]/route.ts` - Get/update/delete profile API
- `data/profiles.json` - Profile storage (auto-created)

### Profile Data Structure

```typescript
interface Profile {
	id: string; // UUID
	name: string; // Display name
	avatar?: string; // Emoji avatar (default: 👤)
	createdAt: string; // ISO timestamp
}
```

### Storage Locations

- **Profiles**: `data/profiles.json`
- **Save States**: `roms/{system}/saves/{profileId}/{gameName}.state`
- **SRM Saves**: `roms/{system}/saves/{profileId}/{gameName}.srm`

**Directory Structure Example**:

```
roms/
├── n64/
│   ├── Super Mario 64.z64
│   └── saves/
│       ├── abc-123-uuid/              # John's profile
│       │   ├── Super Mario 64.state   # John's save state
│       │   └── Super Mario 64.srm     # John's in-game saves
│       └── def-456-uuid/              # Sarah's profile
│           ├── Super Mario 64.state
│           └── Super Mario 64.srm
└── snes/
    ├── Super Metroid.sfc
    └── saves/
        └── abc-123-uuid/
            └── Super Metroid.srm
```

### Mobile (Phone) - PWA Approach

> **Note**: The Expo mobile app (`/mobile`) is **deprecated**. Use the PWA instead.

The server hosts a Progressive Web App (PWA) that can be installed on any device:

- **Install**: On mobile Chrome/Safari, tap "Add to Home Screen"
- **Offline**: Service worker caches EmulatorJS assets and game library
- **Native Feel**: Runs in standalone mode without browser chrome
- **Controllers**: Browser Gamepad API auto-detects USB/Bluetooth controllers

#### Why PWA Over Native App?

The original Expo app was redundant—it just opened a WebView to the server anyway. PWA provides:

1. Single codebase (no separate mobile app to maintain)
2. Same EmulatorJS experience on all devices
3. Native gamepad support via browser APIs
4. Works on iOS, Android, and desktop

## Coding Guidelines

### TypeScript Conventions

- Use strict TypeScript (`strict: true` in tsconfig)
- Prefer `interface` over `type` for object shapes
- Use barrel exports (`index.ts`) for clean imports
- Name files: `kebab-case.ts` for utilities, `PascalCase.tsx` for components

### Component Patterns

```tsx
// Server: src/app/components/GameCard.tsx
export function GameCard({ game, onSelect }: GameCardProps) { ... }

// Mobile: src/components/VirtualController.tsx
export function VirtualController({ onInput }: VirtualControllerProps) { ... }
```

### Socket.IO Events

| Event         | Direction      | Payload                          | Purpose                 |
| ------------- | -------------- | -------------------------------- | ----------------------- |
| `input`       | Phone → Server | `{ button, pressed, timestamp }` | Button press/release    |
| `analog`      | Phone → Server | `{ stick, x, y }`                | Analog stick position   |
| `load_game`   | Phone → Server | `{ gameId }`                     | Request to load a game  |
| `game_loaded` | Server → Phone | `{ success, game }`              | Game load confirmation  |
| `signal`      | Both           | WebRTC signaling data            | WebRTC connection setup |

## Project Structure

```text
online-emu/
├── server/                 # Next.js server (runs on PC)
│   ├── src/
│   │   ├── app/           # App Router pages & API
│   │   │   ├── api/       # REST endpoints
│   │   │   │   ├── profiles/  # Profile CRUD API
│   │   │   │   ├── saves/     # Save state API
│   │   │   │   ├── srm/       # SRM saves API
│   │   │   │   └── config/    # Emulator config API
│   │   │   ├── profiles/  # Profile selection page
│   │   │   ├── play/      # Local emulator page (iframe wrapper)
│   │   │   └── settings/  # Configuration page
│   │   ├── lib/           # Utilities
│   │   │   ├── profiles.ts        # Profile storage functions
│   │   │   └── emulator-config.ts # Emulator path config
│   │   └── middleware.ts  # Profile check & routing
│   ├── data/              # App data (auto-created)
│   │   ├── profiles.json       # User profiles storage
│   │   └── server.ts          # Custom Next.js server
│
├── mobile/                 # ⚠️ DEPRECATED - Use PWA instead
│   └── ...                 # Expo app (kept for reference only)
│
└── .github/
    ├── copilot-instructions.md  # This file
    ├── instructions/            # Path-specific instructions
    └── todos.md                 # Development progress
```

## Key Commands

```bash
# Local Development
cd server && npm install      # Installs deps + downloads EmulatorJS
cd server && npm run dev      # Start dev server (localhost:3000)
cd server && npm run build    # Build for production

# Production Deployment (Vultr VPS)
cd server && npm install      # Install dependencies
cd server && npm run build    # Build production bundle
npm install -g pm2            # Install PM2 globally
pm2 start ecosystem.config.js # Start with PM2
pm2 save                      # Save PM2 process list
pm2 startup                   # Enable auto-start on boot

# PWA Installation
# 1. Open localhost:3000 (dev) or http://your-server-ip:3000 (prod) in mobile browser
# 2. Tap "Add to Home Screen" in Chrome/Safari menu
# 3. App installs with offline support
```

## Deployment Strategy (Vultr VPS)

**Recommended Plan**: Standard ($12/mo)

- 80GB SSD Storage
- 4GB RAM
- 3TB Monthly Bandwidth
- Sufficient for 200+ retro games or 50+ PSX/PSP titles

**Setup Overview**:

1. Clone repo and install dependencies
2. Upload ROMs to `public/roms/{system}/`
3. Build production bundle (`npm run build`)
4. Start with PM2 for process management
5. Configure Nginx reverse proxy (optional, for SSL/domain)
6. Set up SSL with Let's Encrypt (recommended for HTTPS)

## Resources

- [EmulatorJS Docs](https://emulatorjs.org/docs)
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Vultr Docs](https://www.vultr.com/docs/)
- [PM2 Guide](https://pm2.keymetrics.io/docs/usage/quick-start/)

## AI Agent Workflow

1. Read `.github/todos.md` for current tasks and progress
2. Check path-specific instructions in `.github/instructions/`
3. Use Context7 MCP for library documentation before implementing
4. Preserve existing code; add comments explaining WHY, not WHAT
5. Update todos.md status after completing tasks
