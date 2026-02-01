# Online Emulator - Development TODOs

## Status Legend

- ��� **Todo** - Not started
- ��� **In Progress** - Currently being worked on
- ✅ **Completed** - Finished

---

## ✅ Phase 1: Local User Profiles (Completed)

### Summary

**Problem**: Auth.js required Google OAuth credentials and internet access. For a self-hosted hobby project shared via source code, this was overkill.

**Solution**: Simple local user profile system like Netflix/Plex:

- Landing page with user selection tiles
- Users are just names (no passwords)
- Profile ID used for save files and preferences
- Works completely offline

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Landing Page (/profiles)                                    │
│                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│   │  ���     │  │  ���     │  │  ���     │  │   ➕    │      │
│   │  John   │  │  Sarah  │  │  Guest  │  │  New    │      │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
│                                                             │
│   Click to select → Stored in cookie → Home page           │
└─────────────────────────────────────────────────────────────┘

Storage:
- /data/profiles.json - List of profiles { id, name, avatar, createdAt }
- Cookie: profileId - Currently selected profile ID
- /roms/{system}/saves/{gameId}/{profileId}.state - Per-user save states  
- /roms/{system}/saves/{gameId}/{profileId}.srm - Per-user SRM saves
```

### Completed Tasks

#### 1. Remove Auth.js (Clean Up)

- ✅ 1.1 Uninstall `next-auth` package
- ✅ 1.2 Delete `src/lib/auth.ts`
- ✅ 1.3 Delete `src/app/auth/` directory (signin, error pages)
- ✅ 1.4 Delete `src/app/api/auth/` directory
- ✅ 1.5 Delete `src/app/providers.tsx`
- ✅ 1.6 Simplify `src/middleware.ts` (profile-based routing)
- ✅ 1.7 Update `src/app/layout.tsx` (remove Providers wrapper)
- ✅ 1.8 Remove auth imports from `src/app/page.tsx`

#### 2. Create Profile Types & Storage

- ✅ 2.1 Add Profile interface to `src/types/index.ts`
- ✅ 2.2 Create `src/lib/profiles.ts` for server-side profile CRUD
- ✅ 2.3 Profile storage auto-creates `data/profiles.json` on first use
- ✅ 2.4 Create profile API: `GET /api/profiles` (list all)
- ✅ 2.5 Create profile API: `POST /api/profiles` (create new)
- ✅ 2.6 Create profile API: `GET/PATCH/DELETE /api/profiles/[id]`

#### 3. Create Profile UI Components

- ✅ 3.1 Create `src/app/profiles/page.tsx` (profile selection landing page)
- ✅ 3.2 Profile tiles with emoji avatars
- ✅ 3.3 Create new profile modal with avatar selection
- ✅ 3.4 Delete profile confirmation modal
- ✅ 3.5 Auto-redirect to home after profile selection

#### 4. Integrate Profiles with Existing Features

- ✅ 4.1 Update `src/app/page.tsx` header to show current profile
- ✅ 4.2 Add "Switch" button to change profiles
- ✅ 4.3 Middleware redirects to /profiles if no cookie set

#### 5. Update Documentation

- ✅ 5.1 Rewrite `copilot-instructions.md` - remove auth, add profiles
- ✅ 5.2 Update `.env.example` - remove auth variables
- ✅ 5.3 Update project structure in docs
- ✅ 5.4 Add detailed comments to new files

---

## ✅ Phase 2: Per-Profile Save Files (Completed)

### Summary

**Problem**: All profiles currently share the same save files. If two users play the same game, they overwrite each other's saves.

**Solution**: Namespace save files by profile ID:

- Old: `{gamesDir}/{system}/saves/{gameId}.state`
- New: `{gamesDir}/{system}/saves/{profileId}/{gameId}.state`

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Save File Path Structure                                    │
│                                                             │
│ roms/                                                       │
│   └── n64/                                                  │
│       └── saves/                                            │
│           ├── abc123-profile-id/         # John's saves     │
│           │   ├── Mario64.state          # Save state       │
│           │   └── Mario64.srm            # In-game save     │
│           └── def456-profile-id/         # Sarah's saves    │
│               ├── Mario64.state                             │
│               └── Mario64.srm                               │
└─────────────────────────────────────────────────────────────┘

Flow:
1. User plays game → iframe sends save request
2. Request includes cookie: profileId=abc123
3. API reads cookie → builds path with profileId
4. Save written to profile-specific directory
```

### Completed Tasks

#### 1. Update Save State API (`/api/saves/[gameId]`)

- ✅ 1.1 Read `profileId` from request cookie
- ✅ 1.2 Return 401 if no profileId cookie (user not logged in)
- ✅ 1.3 Update path: `{gamesDir}/{system}/saves/{profileId}/{gameId}.state`
- ✅ 1.4 Add fallback: check legacy path if profile path not found (migration)
- ✅ 1.5 Log profile ID for debugging

#### 2. Update SRM API (`/api/srm/[gameId]`)

- ✅ 2.1 Read `profileId` from request cookie
- ✅ 2.2 Return 401 if no profileId cookie
- ✅ 2.3 Update path: `{gamesDir}/{system}/saves/{profileId}/{gameId}.srm`
- ✅ 2.4 Add fallback: check legacy path if profile path not found
- ✅ 2.5 Log profile ID for debugging

#### 3. Migration & Backwards Compatibility

- ✅ 3.1 Add console warning when legacy save found (not auto-migrated)
- ✅ 3.2 Document manual migration steps in comments
- ✅ 3.3 Legacy saves still work but are read-only (new saves go to profile dir)

#### 4. Documentation Updates

- ✅ 4.1 Update `copilot-instructions.md` storage paths section
- ✅ 4.2 Update `copilot-instructions.md` API documentation
- ✅ 4.3 Update `todos.md` with completion status

---

## ✅ Phase 3: Save Optimization, PWA & External Emulators (Completed)

### Summary

**Problems Solved**:

1. ✅ Saves happened every 30 seconds even when nothing changed (wasteful)
2. ✅ PWA installation not working (manifest path issue)
3. ✅ External emulator setup for PS2/GameCube

**Solutions Implemented**:

1. Event-based saves - only save when EmulatorJS notifies of changes via `EJS_onSaveUpdate`
2. Fixed manifest path from `.webmanifest` to `.json` in layout.tsx
3. Created settings page for external emulator configuration

### Completed Tasks

#### 1. Event-Based Saves

- ✅ Removed `startServerAutoSave()` interval function
- ✅ Removed `startSrmAutoSave()` interval function
- ✅ Modified `EJS_onSaveUpdate` to trigger server save with debounce
- ✅ Added 500ms debounce to prevent save spam
- ✅ Kept visibility/blur/pagehide handlers as backup

#### 2. PWA Installation

- ✅ Changed manifest link from `.webmanifest` to `.json` in layout.tsx
- ✅ Updated middleware public paths for manifest.json
- ✅ Added `id: "/"` to manifest.ts for PWA identification

#### 3. External Emulator UI

- ✅ Created `/settings` page with emulator path configuration
- ✅ Created `/api/launch` endpoint for launching external emulators
- ✅ Updated play page to show "Launch in PCSX2" button for PS2 games
- ✅ Added "🖥️ PC" badge for external emulator games in library
- ✅ Updated PCSX2 CLI args: `-fullscreen -batch -- {ROM}`

---

## ✅ Phase 4: PS2/GameCube Emulation Research (Completed)

### Research Summary

**Question**: Can PS2/GameCube games run through the web app instead of launching external emulators?

### Findings

#### Option A: Play! PS2 Emulator (WebAssembly) ⭐ VIABLE

**Play!** (<https://github.com/jpd002/Play->) is a PS2 emulator with WebAssembly support.

```
Pros:
✅ Runs entirely in browser (no external app needed)
✅ No BIOS file required
✅ Works with ISO, CSO, CHD, ISZ, BIN, ELF files
✅ Already deployed at https://playjs.purei.org/
✅ Can be self-hosted
✅ Has libretro core for RetroArch integration

Cons:
❌ Lower compatibility than PCSX2 (many games don't work)
❌ WebAssembly JIT cache invalidation issues
❌ Browser floating point rounding causes issues in some games
❌ Slower than native PCSX2
```

**Conclusion**: Could replace PCSX2 for browser-based PS2 emulation, but with lower compatibility.

#### Option B: Sunshine/Moonlight Streaming ⭐ BEST QUALITY

**Sunshine** is a self-hosted game streaming server that works with **Moonlight** clients.

```
How it works:
1. PCSX2/Dolphin runs on PC with full GUI
2. Sunshine captures screen and encodes video (hardware accelerated)
3. Moonlight client on phone receives stream
4. Controller input sent back via network

Pros:
✅ Full PCSX2/Dolphin compatibility
✅ Hardware encoding (very low latency)
✅ Works with ANY emulator or game
✅ Moonlight available on iOS, Android, Switch, etc.

Cons:
❌ Requires installing Sunshine separately
❌ Not integrated into our app
❌ User manages two separate apps
```

**Conclusion**: Best option for high-quality PS2/GameCube streaming, but separate from our project.

#### Option C: Dolphin Batch Mode (Current Implementation)

```
Command: Dolphin.exe -e "game.iso" -b -c
  -e: Execute game file
  -b: Batch mode (exit when game closes)
  -c: Confirm on stop

Pros:
✅ Already implemented
✅ Clean command-line launch

Cons:
❌ Still needs separate streaming solution
❌ Game window appears on PC, not in browser
```

#### Option D: RetroArch Web Player

RetroArch has a web player but **NO PS2/GameCube cores** for web:

- Web cores: NES, SNES, GB/GBA, N64, PS1, Genesis, Saturn, etc.
- NOT available for web: PS2, GameCube, Wii

**Conclusion**: Cannot use for PS2/GameCube.

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Emulation Tiers                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Tier 1: EmulatorJS (In-Browser) ✅ Current                  │
│   • NES, SNES, GB, GBA, N64, DS, PSX, PSP, Genesis, etc.   │
│   • Full browser integration                                │
│   • Save states, SRM saves to server                        │
│                                                             │
│ Tier 2: Play! WebAssembly (Experimental) 🔄 Optional        │
│   • PS2 games with lower compatibility                      │
│   • Could integrate similar to EmulatorJS                   │
│   • No BIOS required                                        │
│                                                             │
│ Tier 3: External Emulators (Current) ✅ Implemented         │
│   • PCSX2 for PS2 (best compatibility)                      │
│   • Dolphin for GameCube/Wii                                │
│   • Launched via command line                               │
│   • Game runs on PC monitor                                 │
│                                                             │
│ Tier 4: Sunshine/Moonlight (Separate) ℹ️ User Setup         │
│   • Best streaming quality                                  │
│   • User installs Sunshine + Moonlight separately           │
│   • Works with any emulator/game                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Decision

**Current approach is correct.** PS2/GameCube are too demanding for WebAssembly with acceptable compatibility. Users should either:

1. **Use external emulators** (current implementation) - game plays on PC monitor
2. **Set up Sunshine/Moonlight** (separate) - if they want to stream to phone

---

## ✅ Phase 5: Sunshine + Moonlight-Web Streaming (Completed)

### Summary

**Problem**: PS2/GameCube games require powerful emulators (PCSX2/Dolphin) that can't run in WebAssembly. Current "external emulator" solution plays games on PC monitor, not streamed to phone.

**Solution**: Integrate Sunshine (streaming server) + moonlight-web-stream (browser client) for PS2/GC games:

- Sunshine captures PCSX2/Dolphin with hardware encoding (NVENC/QuickSync/AMF)
- moonlight-web-stream converts Moonlight protocol → WebRTC
- Phone browser receives video stream + sends controller input
- EmulatorJS remains for all other systems (NES, SNES, GB, GBA, N64, PSX, etc.)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Emulation Tiers (Updated)                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Tier 1: EmulatorJS (In-Browser) ✅ Unchanged                    │
│   • NES, SNES, GB, GBA, N64, DS, PSX, PSP, Genesis, etc.       │
│   • Full browser integration                                    │
│   • Save states, SRM saves to server                            │
│                                                                 │
│ Tier 2: Sunshine + Moonlight-Web (NEW) 🔄 In Progress           │
│   • PS2 games via PCSX2                                         │
│   • GameCube/Wii games via Dolphin                              │
│   • Hardware-accelerated streaming to browser                   │
│   • Low latency via WebRTC                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Data Flow:

┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│ Our Next.js  │────►│ Sunshine     │────►│ PCSX2/Dolphin        │
│ App (3000)   │ API │ (47990)      │ Run │ (Native Emulator)    │
└──────────────┘     └──────┬───────┘     └──────────────────────┘
                           │ Moonlight Protocol
                           ▼
                    ┌──────────────┐
                    │ moonlight-   │
                    │ web-stream   │
                    │ (8080)       │
                    └──────┬───────┘
                           │ WebRTC
                           ▼
                    ┌──────────────┐
                    │ Phone PWA    │
                    │ (Browser)    │
                    └──────────────┘
```

### Prerequisites (User Must Install)

1. **Sunshine** - Self-hosted game streaming server
   - Download: https://github.com/LizardByte/Sunshine/releases
   - Default ports: 47989 (RTSP), 47990 (Web UI/API)
   - Requires admin password setup on first run

2. **moonlight-web-stream** - Browser-based Moonlight client
   - Download: https://github.com/MrCreativ3001/moonlight-web-stream/releases
   - Default port: 8080
   - Must pair with Sunshine (enter PIN from Sunshine Web UI)

3. **PCSX2** (for PS2 games)
   - Download: https://pcsx2.net/downloads
   - CLI: `pcsx2.exe "{ROM}" --fullscreen --nogui`

4. **Dolphin** (for GameCube/Wii games)
   - Download: https://dolphin-emu.org/download
   - CLI: `Dolphin.exe -e "{ROM}" -b`

### Sunshine API Reference

```
Base URL: https://localhost:47990 (requires Basic Auth)

GET  /api/apps          - List all apps
POST /api/apps          - Add/update app
POST /api/apps/close    - Close running app
DELETE /api/apps/{idx}  - Delete app

App JSON Format:
{
  "name": "Game Name",
  "cmd": "C:\\path\\to\\emulator.exe \"{ROM}\"",
  "working_dir": "C:\\path\\to",
  "index": -1,  // -1 for new, existing index for update
  "image-path": "C:\\path\\to\\cover.png",
  "auto-detach": true,
  "elevated": false
}
```

### Tasks

#### Step 1: Sunshine Service Module ✅

**Logic**: Create a service that communicates with Sunshine's REST API to manage emulator apps.

- ✅ 1.1 Create `src/lib/sunshine-service.ts` with API client
- ✅ 1.2 Implement `checkConnection()` - verify Sunshine is running
- ✅ 1.3 Implement `listApps()` - get registered apps
- ✅ 1.4 Implement `addApp(game)` - register emulator launch command
- ✅ 1.5 Implement `closeApp()` - stop current streaming session
- ✅ 1.6 Add proper error handling for connection failures

#### Step 2: Configuration & Settings ✅

**Logic**: Users need to configure Sunshine URL, credentials, emulator paths, and moonlight-web URL.

- ✅ 2.1 Add Sunshine settings to `src/lib/emulator-config.ts` (in sunshine-service.ts)
- ✅ 2.2 Create `/api/sunshine/config/route.ts` for saving settings
- ✅ 2.3 Update settings page with Sunshine section
- ✅ 2.4 Add moonlight-web-stream URL setting
- ✅ 2.5 Add connection test button with status indicator
- ✅ 2.6 Store credentials securely (in data/sunshine-config.json)

#### Step 3: Game Type Detection ✅

**Logic**: Distinguish between EmulatorJS games and Sunshine-streamed games based on system.

- ✅ 3.1 Add `streamingType` to game types: `'emulatorjs' | 'sunshine'`
- ✅ 3.2 Update types/index.ts with `getStreamingType()` helper
- ✅ 3.3 PS2 (`psx2`) and GameCube (`gc`) use `'sunshine'`
- ✅ 3.4 All other systems default to `'emulatorjs'`
- ✅ 3.5 Update GameCard UI to show "📡 Stream" badge

#### Step 4: API Endpoints ✅

**Logic**: Create API endpoints for the frontend to interact with Sunshine.

- ✅ 4.1 Create `/api/sunshine/status/route.ts` - check connection
- ✅ 4.2 Create `/api/sunshine/config/route.ts` - GET/POST config
- ✅ 4.3 Create `/api/sunshine/launch/route.ts` - launch game
- 🔲 4.4 Create `/api/sunshine/close/route.ts` - close session (deferred)
- 🔲 4.5 Proxy moonlight-web-stream if needed (not required)

#### Step 5: Streaming Page ✅

**Logic**: Create a new page that embeds moonlight-web-stream player and launches games.

- ✅ 5.1 Create `/stream/[gameId]/page.tsx` for Sunshine games
- ✅ 5.2 Implement game launch on page load via Sunshine API
- ✅ 5.3 Embed moonlight-web-stream player in iframe
- ✅ 5.4 Add fullscreen toggle and controls overlay
- ✅ 5.5 Handle connection errors gracefully
- ✅ 5.6 Add "back to library" navigation

#### Step 6: Play Page Routing ✅

**Logic**: Route users to correct page based on game's streaming type.

- ✅ 6.1 Update page.tsx handleSelectGame to check streamingType
- ✅ 6.2 EmulatorJS games → `/play?game=...` (existing)
- ✅ 6.3 Sunshine games → `/stream/{gameId}` (new)
- ✅ 6.4 Show not-configured state if Sunshine not set up

#### Step 7: Documentation ✅

**Logic**: Update all documentation with new architecture and setup instructions.

- ✅ 7.1 Update README with Sunshine setup guide
- ✅ 7.2 Update `copilot-instructions.md` architecture section
- ✅ 7.3 Add troubleshooting for common Sunshine issues
- ✅ 7.4 Document moonlight-web-stream pairing process

---

## Future Ideas (Not Planned)

- 🔲 Profile-specific preferences (theme, default system, etc.)
- 🔲 Profile import/export
- 🔲 Cloud sync (optional, for those who want it)
- 🔲 Remote access via Tailscale or Cloudflare Tunnel
- 🔲 Play! PS2 emulator integration (WebAssembly)
