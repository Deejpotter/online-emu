# Online Emulator - Development TODOs

## Current Phase: Dual Deployment (Local PC + Coolify/R2)

**Goal**: Support two production paths:

1. **Local PC + Cloudflare Tunnel** — `roms.deejpotter.com` via PM2 on DESKTOP-UBV27I5 (`LIBRARY_SOURCE=local`, `GAMES_DIR=H:\Games`)
2. **Coolify + R2** — stateless container, ROMs/library from Cloudflare R2 ([docs/COOLIFY.md](../docs/COOLIFY.md))

**Note**: Vultr VPS plan archived. Coolify/R2 code is on `main` (Dockerfile, `library-source.ts`, upload scripts).

---

## Status Legend

- ⬜ **Todo** - Not started
- 🔄 **In Progress** - Currently being worked on
- ✅ **Completed** - Finished
- ⏳ **Blocked** - Waiting on something

---

## 📋 Local PC + Cloudflare Tunnel Deployment

### ✅ Step 1: Build
- ✅ 1.1: `yarn install` — dependencies installed
- ✅ 1.2: `yarn build` — production bundle built

### ✅ Step 2: Start with PM2
- ✅ 2.1: Install PM2 globally if not present (`npm install -g pm2`)
- ✅ 2.2: Start app (`pm2 start ecosystem.config.js`)
- ✅ 2.3: Save PM2 process list (`pm2 save`)
- ✅ 2.4: Enable auto-start on boot (`pm2-startup install`)
- ✅ 2.5: App running on port 3100

### ✅ Step 3: Cloudflare DNS
- ✅ 3.1: CNAME added via `cloudflared tunnel route dns krasus roms.deejpotter.com`
- ✅ 3.2: Tunnel config has `roms.deejpotter.com → http://localhost:3100`
- ✅ 3.3: cloudflared restarted (taskkill + Start-Service pattern)
- ✅ 3.4: `https://roms.deejpotter.com` confirmed accessible (200 OK)

### ✅ Step 4: Add ROMs
- ✅ 4.1: External drive `H:\` identified ("Big Bertha", 1.8TB)
- ✅ 4.2: ROMs at `H:\Games\{System}\ROMs\` — ~40 system folders
- ✅ 4.3: `.env` updated with `GAMES_DIR=H:\Games`, PM2 restarted

### ✅ Step 5: Testing & Verification
- ✅ 5.1: Profile creation works
- ✅ 5.2: Games load and run (GBA confirmed, Fire Red and Leaf Green)
- ⬜ 5.3: Auto-save state (every 60s) — verify per [.github/MANUAL-QA.md](MANUAL-QA.md)
- ⬜ 5.4: Auto-load save state on game start — verify per MANUAL-QA
- ✅ 5.4b: SRM (in-game saves) save and load — confirmed working in PM2 logs
- ⬜ 5.5: Verify PWA installable on mobile — per MANUAL-QA

---

## ✅ Coolify + R2 Deployment (Code Complete)

Operational steps documented in [docs/COOLIFY.md](../docs/COOLIFY.md).

- ✅ R2 manifest populated (3744 games, 5 systems)
- ✅ `scripts/seed-library-from-r2.js`, `scan-library.js`, `verify-r2-flow.js`
- ✅ `/api/roms/[...path]` — R2 first, local fallback
- ✅ Dockerfile uses `yarn --frozen-lockfile`, port 80, `/data` volume paths
- ✅ GitHub Actions CI (`.github/workflows/ci.yml`)
- ⬜ Coolify app created and domain attached (manual in Coolify UI)
- ⬜ Post-deploy browser verification — per MANUAL-QA

---

## 🔴 Phase 7: EmulatorJS Bug Fixes (Active — 2026-05-02)

### Summary

Three bugs reported when attempting to play a GBA game (Pokémon Leaf Green):

1. **Translation warnings** — EmulatorJS logs "Translation not found" for every UI string including `LEFT_STICK_X`, `right arrow`, `-1`, `+1`, etc. Root cause: `localization/en-US.json` is `{}` (empty 2-byte file). Setup script downloads cores but never downloads the localization folder.

2. **"Error downloading game state" + black screen** — `EJS_loadStateURL` is set in `emulator.html` which tells EmulatorJS to fetch a save state on startup. For a new game, the server returns a JSON 404 `{"success":false,"error":"Save file not found"}`. EmulatorJS tries to interpret that JSON as binary save state data → fails → shows error and halts emulator init. The design comment even says "We do NOT auto-load save states anymore" — `EJS_loadStateURL` directly contradicts this.

3. **30-second load timeout** — Consequence of bug 2. Emulator is halted, `EJS_onGameStart` never fires, 30s timer trips.

**Bonus**: `/api/roms` not in middleware public paths — currently relies on browser cookie being present. ROMs don't need auth so it should be explicit.

---

### Step 1: Fix `localization/en-US.json` (translation warnings)

**Logic**: EmulatorJS loads `en-US.json` at startup to translate all its UI strings. The file is empty, so every lookup fails with a console warning. The real file lives at `https://cdn.emulatorjs.org/stable/data/localization/en-US.json` and contains ~250 entries including `LEFT_STICK_X`, `LEFT_STICK_Y`, `right arrow`, etc. The `-1`/`+1` warnings come from the control mapping code (`value2 = 'LEFT_STICK_X:-1'`) — EmulatorJS splits on `:` and tries to translate both the axis name AND the numeric suffix. Fixing en-US.json eliminates most warnings; we add the numeric keys (`-1`, `+1`, `1`, `2`, `3`) manually to clean up the rest.

**Sub-steps**:
- ✅ 1.1: Download real `en-US.json` from CDN and write to `public/emulatorjs/data/localization/en-US.json`
- ✅ 1.2: Add missing numeric axis keys (`-1`, `+1`, `1`, `2`, `3`) to the file
- ✅ 1.3: Add localization file download to `scripts/setup-emulatorjs.js` so it's fetched automatically on reinstall

---

### Step 2: Remove `EJS_loadStateURL` (main emulator blocker)

**Logic**: `EJS_loadStateURL` was added to auto-restore the last save state on game start. However:
- For a new game, the server returns a JSON 404 error body (not binary data)
- EmulatorJS tries to parse that JSON as a save state and fails → "Error downloading game state" banner → emulator halted
- The current design uses `EJS_onGameStart` to load SRM (in-game saves) after start — that is correct
- Save states are for manual quick-save/load only, not auto-restore
- The comment already says "We do NOT auto-load save states anymore"
- Removing `EJS_loadStateURL` unblocks emulator init for all new games

**Sub-steps**:
- ✅ 2.1: Remove `window.EJS_loadStateURL = ...` line from `public/emulator.html`
- ✅ 2.2: Remove the associated `console.log` for it
- ✅ 2.3: Add a comment explaining why it's absent (intentional, not forgotten)

---

### Step 3: Add `/api/roms` to middleware public paths

**Logic**: The middleware redirects unauthenticated requests to `/profiles`. ROM files are served via `/api/roms/...`. While browser requests include the `profileId` cookie (so they usually work), making `/api/roms` explicitly public is correct because:
- ROM serving does not need auth — it's a file server
- Removes a latent bug where the cookie might not be present in edge cases (e.g. emulator.html same-origin fetch before cookie set)
- Consistent with `/emulatorjs` which is already public

**Sub-steps**:
- ✅ 3.1: Add `/api/roms` to `publicPaths` array in `src/middleware.ts`
- ✅ 3.2: Add `/emulator.html` to `publicPaths` (the iframe page itself — currently served as a static file, which bypasses middleware, but being explicit is correct)

---

### Step 4: Rebuild and restart PM2

**Logic**: `emulator.html` and `middleware.ts` are server-side changes that require a production rebuild to take effect (PM2 runs the compiled build). The localization JSON is a static file served from `public/` — it's available immediately without rebuild, but rebuild ensures everything is consistent.

**Sub-steps**:
- ✅ 4.1: `yarn build` in `C:\Users\Deej\Repos\online-emu`
- ✅ 4.2: `pm2 restart onlineemu --update-env`
- ✅ 4.3: `pm2 status` — verify `onlineemu` is online

---

### Step 5: Verify fixes

**Logic**: Confirm all three reported bugs are resolved.

**Sub-steps**:
- ⬜ 5.1–5.5: Browser verification — see [.github/MANUAL-QA.md](MANUAL-QA.md)

---

## Previous Completed Phases

<details>
<summary>✅ Event-Based Saves</summary>

Replaced 30-second polling with event-driven saves:
- `EJS_onSaveUpdate` fires when game writes SRM → immediate server upload
- `EJS_onSaveState` fires on manual save → immediate server upload
- Fallback: visibilitychange + blur events still flush saves
- Removed `debouncedSaveToServer` dead function
- Removed misleading `beforeunload` confirm dialog

</details>

<details>
<summary>✅ Phase 1: Local User Profiles</summary>

Replaced Auth.js OAuth with simple local profile system (no passwords, works offline).
- Created `/profiles` landing page with user tiles
- Profile storage in `data/profiles.json`
- Middleware enforces profile selection
- No authentication required

</details>

<details>
<summary>✅ Phase 2: Per-Profile Save Files</summary>

Namespaced save files by profile ID:
- Old: `roms/{system}/saves/{game}.state`
- New: `roms/{system}/saves/{profileId}/{game}.state`
- Legacy save migration support

</details>

<details>
<summary>✅ Phase 3: Save Optimization & PWA</summary>

- Event-based saves (removed poll interval)
- Fixed PWA manifest path
- Added PS2/GameCube desktop emulator support (now removed)

</details>

<details>
<summary>✅ Phase 4: PS2/GameCube Emulation Research</summary>

Researched Play!, Sunshine/Moonlight, RetroArch web player. Decision: browser-only for supported systems, external PCSX2/Dolphin for PS2/GameCube.

</details>

<details>
<summary>✅ Phase 5: UX & Stability Improvements</summary>

- Fixed TypeScript errors
- Added skeleton loaders
- Improved mobile UX (44px touch targets)
- Toast notifications for save/load feedback

</details>

<details>
<summary>✅ Phase 6: Production Deployment</summary>

- Fixed build errors (Suspense boundary, syntax error)
- PM2 on port 3100
- Cloudflare tunnel at roms.deejpotter.com
- pm2-windows-startup for autostart

</details>

---

## ✅ Testing: Automated test coverage

- ✅ SRM API edge tests (`src/app/api/srm/__tests__/srm-api.additional.test.ts`)
- ✅ Save-state API edge tests (`src/app/api/saves/__tests__/saves-api.additional.test.ts`)
- ✅ `EmulatorContent` component tests
- ✅ `game-library` helper + scan tests
- ✅ ROMs API tests (`src/app/api/roms/__tests__/roms-api.test.ts`)
- ✅ CI workflow runs `yarn test` on PRs (`.github/workflows/ci.yml`)

Run locally: `yarn test && yarn lint && yarn build`

---

## Manual verification checklist

- Play a game with in-game save (SRM), trigger Save inside the game.
- Watch emulator UI: should show `SAVING...` then `SRM SAVED TO SERVER`.
- Parent page should display toast `Saving in-game save...` then `In-game save uploaded to server`.
- Reload and confirm in-game save was restored.
- Use `/api/srm/{gameId}?system={system}` to verify SRM file exists on server.

---

## Future Ideas (Not Planned)

- 🔲 Profile-specific preferences (theme, default system, etc.)
- 🔲 Profile import/export
- 🔲 Cloud sync (optional)
- 🔲 Play! PS2 emulator integration (WebAssembly)
