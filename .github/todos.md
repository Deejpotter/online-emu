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

## 🔄 Phase 5: UX & Stability Improvements (In Progress)

### Summary

**Problem**: The app has rough edges in UX and several code quality issues that affect stability and developer experience.

**Solution**: Polish the user experience and fix code issues:

- Fix TypeScript/linting errors
- Add proper loading states and error handling
- Improve mobile responsiveness
- Add visual feedback and animations
- Clean up documentation

### Analysis

**Current Issues Identified**:

1. **TypeScript errors**: State comparison issue in EmulatorContent.tsx
2. **Missing loading states**: Some API calls don't show loading feedback
3. **Mobile UX**: Header controls could be more touch-friendly
4. **Error recovery**: Limited retry options when things fail
5. **Documentation**: README still has Sunshine content that should be removed

### Tasks

#### Step 1: Fix TypeScript & Linting Errors

**Logic**: Clean up compile-time errors to improve code quality and prevent runtime issues.

- ✅ 1.1 Fix EmulatorContent.tsx state comparison (`"ready"` vs allowed types)
- ✅ 1.2 Update Tailwind classes to modern syntax (bg-gradient-to-b → bg-linear-to-b)
- ✅ 1.3 Fix aspect ratio classes (aspect-[4/3] → aspect-4/3)
- ✅ 1.4 Verify no unused imports or variables
- ✅ 1.5 Remove leftover stream directory (missed during Sunshine cleanup)
- ✅ 1.6 Fix SYSTEM_CORES type to handle external systems

#### Step 2: Improve Error Handling & Recovery

**Logic**: Users should always have a path forward when something fails.

- ✅ 2.1 Add retry button to game library fetch failures
- ✅ 2.2 Add retry button to profile fetch failures
- 🔲 2.3 Better error messages with actionable suggestions
- 🔲 2.4 Graceful degradation when features unavailable

#### Step 3: Enhance Loading States

**Logic**: Users need visual feedback during async operations.

- ✅ 3.1 Add skeleton loaders for game library
- 🔲 3.2 Add loading indicator for profile switching
- 🔲 3.3 Add progress feedback for game loading
- ✅ 3.4 Disable buttons during operations to prevent double-clicks

#### Step 4: Mobile UX Improvements

**Logic**: Many users will play on mobile devices.

- ✅ 4.1 Larger touch targets for buttons (min 44px)
- ✅ 4.2 Better spacing between interactive elements
- 🔲 4.3 Swipe gestures for navigation (optional)
- 🔲 4.4 Optimize game library grid for small screens

#### Step 5: Visual Polish

**Logic**: Small visual improvements make the app feel more polished.

- 🔲 5.1 Consistent transitions and animations
- 🔲 5.2 Hover/focus states for all interactive elements
- 🔲 5.3 Toast notifications for save/load feedback
- 🔲 5.4 System-specific color theming consistency

#### Step 6: Documentation Cleanup

**Logic**: Keep documentation accurate and up-to-date.

- ✅ 6.1 Remove Sunshine content from README (now in ideas branch)
- ✅ 6.2 Update copilot-instructions.md to remove Sunshine references
- 🔲 6.3 Clean up todos.md (archive old completed phases)
- 🔲 6.4 Add contributing guidelines if needed

---

## 📦 Archived: Phase 5 (Sunshine Streaming)

> **Note**: This feature has been moved to the `ideas/sunshine-streaming` branch.
> It provides PS2/GameCube streaming via Sunshine + moonlight-web-stream.
> This is parked for now while we focus on core UX improvements.

---

## Future Ideas (Not Planned)

- 🔲 Profile-specific preferences (theme, default system, etc.)
- 🔲 Profile import/export
- 🔲 Cloud sync (optional, for those who want it)
- 🔲 Remote access via Tailscale or Cloudflare Tunnel
- 🔲 Play! PS2 emulator integration (WebAssembly)
