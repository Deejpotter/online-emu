# Online Emulator - AI Coding Instructions

## Project Overview

Self-hosted game console emulator with two components:

- **Server** (`/server`): Next.js 16 app hosting EmulatorJS in an iframe, streaming video via WebRTC
- **Mobile** (`/mobile`): Expo app displaying video stream with virtual gamepad overlay

## Architecture Decision: Browser-to-Browser WebRTC

We use a "thin client" architecture where:

1. **PC does all emulation** - EmulatorJS runs in a dedicated HTML page (iframe)
2. **WebRTC streams video** - Canvas is captured and sent to phone
3. **Phone only displays + inputs** - Minimal CPU/memory usage on mobile device

This allows powerful consoles (PS1, N64) to run smoothly since the phone just decodes video.

## ⚠️ CRITICAL: EmulatorJS + React/Next.js Integration

**EmulatorJS CANNOT run directly in React components.** Per official docs:

> "To embed within React or a SPA, the only way is to embed an iframe into your page. You cannot run it directly on the page. This will break single page apps, and tamper with the DOM."

### Correct Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Next.js App (React)                                         │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ /play or /stream page (React Component)             │   │
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
- `/src/app/stream/page.tsx` - Streaming page that captures iframe canvas

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

Using a LAN IP like `10.0.0.13` will cause headers to be ignored! Always test via `localhost:3000`.

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

### Server (PC)

- **Framework**: Next.js 16 (App Router) with TypeScript
- **User Profiles**: Simple local profiles (no authentication required)
- **Emulation**: EmulatorJS (self-hosted, runs in iframe)
- **PS2/GameCube**: Sunshine + moonlight-web-stream (hardware-accelerated streaming)
- **Real-time**: Socket.IO 4.8 for controller inputs
- **Streaming**: WebRTC via simple-peer (canvas capture)
- **Discovery**: bonjour-service (mDNS)
- **PWA**: Installable web app with offline support

## Sunshine Streaming (PS2/GameCube)

PS2 and GameCube games use native emulators (PCSX2/Dolphin) with Sunshine for hardware-accelerated streaming.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Emulation Tiers                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Tier 1: EmulatorJS (In-Browser)                                 │
│   • NES, SNES, GB, GBA, N64, DS, PSX, PSP, Genesis, etc.       │
│   • Full browser integration, saves to server                   │
│                                                                 │
│ Tier 2: Sunshine + Moonlight-Web                                │
│   • PS2 games via PCSX2                                         │
│   • GameCube/Wii games via Dolphin                              │
│   • Hardware-accelerated streaming to browser                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Streaming Flow

```
1. User clicks PS2/GC game in library
2. Route to /stream/{gameId} instead of /play
3. POST /api/sunshine/launch registers game in Sunshine
4. Sunshine launches PCSX2/Dolphin with game ROM
5. Sunshine captures screen with NVENC/QuickSync/AMF
6. moonlight-web-stream (port 8080) receives Moonlight protocol
7. moonlight-web-stream converts to WebRTC
8. StreamContent.tsx embeds moonlight-web in iframe
9. User plays with low-latency hardware-accelerated video
```

### Key Files

- `src/lib/sunshine-service.ts` - API client for Sunshine REST API
- `src/app/api/sunshine/status/route.ts` - Connection status endpoint
- `src/app/api/sunshine/config/route.ts` - Configuration GET/POST
- `src/app/api/sunshine/launch/route.ts` - Game launch endpoint
- `src/app/stream/[gameId]/page.tsx` - Streaming page wrapper
- `src/app/stream/[gameId]/StreamContent.tsx` - moonlight-web iframe
- `src/app/settings/page.tsx` - Sunshine configuration UI
- `data/sunshine-config.json` - Stored configuration

### StreamingType

Games are categorized by `streamingType`:

```typescript
type StreamingType = "emulatorjs" | "sunshine";

// PS2 and GameCube use Sunshine
const SUNSHINE_SYSTEMS = ["ps2", "psx2", "gc", "gamecube", "wii"];

function getStreamingType(system: string): StreamingType {
	return SUNSHINE_SYSTEMS.includes(system.toLowerCase())
		? "sunshine"
		: "emulatorjs";
}
```

### Sunshine API Reference

Base URL: `https://localhost:47990` (requires Basic Auth)

```
GET  /api/apps          - List all apps
POST /api/apps          - Add/update app (index: -1 for new)
POST /api/apps/close    - Close running app
DELETE /api/apps/{idx}  - Delete app by index
```

App JSON format for registration:
```json
{
  "name": "GameName",
  "cmd": "C:\\path\\to\\emulator.exe \"{ROM}\"",
  "index": -1,
  "auto-detach": true
}
```

### Configuration Storage

Sunshine config stored in `data/sunshine-config.json`:

```json
{
  "enabled": true,
  "url": "https://localhost:47990",
  "username": "sunshine",
  "password": "encrypted-or-plain",
  "moonlightWebUrl": "http://localhost:8080"
}
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Sunshine not configured" | Complete Settings page setup |
| Connection refused | Check Sunshine is running, URL is correct |
| SSL certificate error | Visit https://localhost:47990 first to accept cert |
| No video in stream | Ensure moonlight-web-stream is paired with Sunshine |
| Game doesn't launch | Check emulator path in Settings, verify ROM path |

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

```
online-emu/
├── server/                 # Next.js server (runs on PC)
│   ├── src/
│   │   ├── app/           # App Router pages & API
│   │   │   ├── api/       # REST endpoints
│   │   │   │   ├── profiles/  # Profile CRUD API
│   │   │   │   ├── saves/     # Save state API
│   │   │   │   ├── srm/       # SRM saves API
│   │   │   │   └── sunshine/  # Sunshine streaming API
│   │   │   ├── profiles/  # Profile selection page
│   │   │   ├── play/      # Local emulator page (iframe wrapper)
│   │   │   ├── stream/    # Sunshine streaming page (moonlight-web)
│   │   │   │   └── [gameId]/ # Dynamic route for game streaming
│   │   │   └── settings/  # Configuration page
│   │   ├── lib/           # Utilities
│   │   │   ├── profiles.ts        # Profile storage functions
│   │   │   ├── sunshine-service.ts # Sunshine API client
│   │   │   └── emulator-config.ts # Emulator path config
│   │   └── middleware.ts  # Profile check & routing
│   ├── data/              # App data (auto-created)
│   │   ├── profiles.json       # User profiles storage
│   │   ├── emulator-config.json # Emulator paths
│   │   └── sunshine-config.json # Sunshine settings
│   ├── public/
│   │   ├── emulator.html  # ⚠️ Static HTML hosting EmulatorJS (NOT React)
│   │   ├── emulatorjs/    # Self-hosted EmulatorJS data
│   │   ├── sw.js          # Service worker for PWA offline support
│   │   └── roms/          # ROM files by system (if local)
│   ├── scripts/           # Setup scripts (including icon generation)
│   ├── .env.example       # Environment variables template
│   └── server.ts          # Custom server with Socket.IO
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
# Server
cd server && npm install      # Installs deps + downloads EmulatorJS
cd server && npm run dev      # Start dev server (localhost:3000)
cd server && npm run setup    # Re-download EmulatorJS if needed

# PWA Installation
# 1. Open localhost:3000 in Chrome/Safari on mobile
# 2. Tap "Add to Home Screen" in browser menu
# 3. App installs with offline support
```

## Streaming Flow

```
1. Phone connects to server via Socket.IO
2. Phone requests game load → Server opens streaming page with EmulatorJS
3. Server captures EmulatorJS canvas → WebRTC video track
4. Phone receives video stream → Displays full-screen
5. Phone sends controller inputs → Server injects into EmulatorJS
6. Repeat step 5 for gameplay
```

## Resolution Strategy

- **Retro games render at native resolution** (256x224 for SNES, etc.)
- **Server upscales to 720p** for WebRTC stream (good quality, low bandwidth)
- **Phone displays at screen size** with hardware video decoding
- This minimizes bandwidth while maintaining visual quality

## Resources

- [EmulatorJS Docs](https://emulatorjs.org/docs)
- [Socket.IO v4](https://socket.io/docs/v4/)
- [simple-peer](https://github.com/feross/simple-peer)

## AI Agent Workflow

1. Read `.github/todos.md` for current tasks and progress
2. Check path-specific instructions in `.github/instructions/`
3. Use Context7 MCP for library documentation before implementing
4. Preserve existing code; add comments explaining WHY, not WHAT
5. Update todos.md status after completing tasks
