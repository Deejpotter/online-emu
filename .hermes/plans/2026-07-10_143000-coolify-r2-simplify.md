# Online-Emu → Coolify + R2 (6-System) Simplification & Cleanup Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Reduce the emulator to the 6 requested systems (NES, SNES, GB, GBC, GBA, N64), **delete everything that can't/won't run** (PSX, PSP, Sega, Atari, Arcade, NDS, GameCube), make R2 the authoritative ROM + library store, and deploy on Coolify as a stateless, ephemeral-safe container.

**Architecture:** Next.js 16 custom server (`server.ts`, port 3100) renders a React UI; EmulatorJS WASM cores run **in the browser**. ROMs are served by `src/app/api/roms/[...path]/route.ts`, which already tries **R2 first, local disk fallback**. We keep R2 as source of truth, stop depending on a local `GAMES_DIR` at runtime, seed the library (`data/metadata.json`) from R2 when absent, and delete the dead systems everywhere (type union, system maps, UI labels/colors, bundled WASM cores, the `postinstall` downloader, docs, tests). Coolify runs the Dockerfile with a **persistent volume on `/data`**.

**Tech Stack:** Next.js 16, React 19, TypeScript, EmulatorJS (self-hosted in `public/emulatorjs`), AWS SDK S3 client (R2-compatible), Coolify (Dockerfile deploy), Cloudflare R2.

---

## Feasibility (can it host on Coolify, will the games fit?)

**✅ Yes.** Evidence from the repo:

| Concern | Finding | Verdict |
|---|---|---|
| Browser cores for the 6 systems | `public/emulatorjs/data/cores/` already ships `fceumm` (NES), `snes9x` (SNES), `gambatte` (GB/GBC), `mgba` (GBA), `mupen64plus_next` (N64) | Present |
| R2 ROM serving | `src/app/api/roms/[...path]/route.ts` `fetchFromR2()` = R2→local fallback | Built |
| R2 upload tooling | `scripts/upload-to-r2.js` | Built |
| Stateful data | `/data/metadata.json`, `/data/profiles.json`, `{GAMES_DIR}/{system}/saves/...` written at runtime | Must be on a volume |

**Will the ROMs fit R2?** Easily. Only **one ROM loads per session** (fetched on demand) — memory is the active ROM + one WASM core, never the whole library. Sizes: NES ~0.5MB, SNES ~2MB, GB/GBC ~1MB, GBA ~8MB, N64 ~32MB avg. R2 free tier = 10GB; cost beyond is negligible.

**Cleanup is mandatory, not cosmetic:** the bundler will still pull the dead cores on every Coolify build via `postinstall`→`setup-emulatorjs.js` (currently lists 10 cores), bloating the image and build time. Trimming that script + deleting the 23 WASM blobs is what makes the deploy lean.

**4 hard fixes before deploy:**
1. `Dockerfile` never copies `public/` → EmulatorJS assets missing in image. Add the copy.
2. `Dockerfile` uses `npm install` despite a `yarn.lock` → switch to `yarn --frozen-lockfile`.
3. `GAMES_DIR` defaults to `H:\Games` (Windows) → set Linux `/data/games`.
4. Library is built by **scanning local disk** → empty on a ROM-less container. Add R2-seeded `ensureLibrary()`.

---

## Current State (for the implementer)

- `src/types/index.ts:49-63` — `EmulatorSystem` union = 14 systems.
- `src/lib/game-library.ts:36-119` — `SYSTEM_EXTENSIONS`, `FOLDER_TO_SYSTEM`, `SYSTEM_NAMES` for 14 systems.
- `src/app/api/systems/route.ts:22-38` — `SYSTEM_CORES` (14).
- `src/app/play/EmulatorContent.tsx:106-121` — `SYSTEM_TO_CORE` (14) + `:392-441` PSP-only `SharedArrayBuffer` guard.
- `src/app/components/GameLibrary.tsx:35-67` — `SYSTEM_LABELS` + `SYSTEM_COLORS` include dead systems + a dead `gamecube` key.
- `src/app/components/GameCard.tsx:24-54` — same two maps + dead `gamecube`.
- `src/app/page.tsx:147-156` — "Supported Systems" list includes NDS/Genesis/PlayStation/PSP/Arcade.
- `src/middleware.ts`, `src/app/api/status/route.ts` — clean (derive from the union, no literals).
- `public/emulatorjs/data/cores/` — 39 git-tracked files; 5 cores (15 blobs) kept, 23 blobs + 5 reports removed.
- `scripts/setup-emulatorjs.js:63-101` — `CORE_REPORT_FILES` + `CORES` list 10 cores; must drop 5.
- `scripts/upload-to-r2.js:58` — `DEFAULT_SYSTEMS = ["gba","gb","nes","snes"]` (missing n64).
- `data/metadata.json` — gitignored; currently holds all 14 systems (must be pruned to 5 for R2 manifest).
- `README.md:86-89,137-139` — references psx/psp/genesis dirs + storage table.
- `src/app/components/__tests__/EmulatorContent.fetch.test.tsx:44-47` — uses a `psp` game.

**GB vs GBC:** no separate `gbc` id — GBC `.gbc` runs under the `gb` id via the `gambatte` core. So NES/SNES/GB/GBC/GBA/N64 = **5 system ids**: `nes`, `snes`, `gb`, `gba`, `n64`.

---

## Step-by-Step Plan

### Task 1: Narrow `EmulatorSystem` type to the 5 system ids

**Objective:** Single source of truth for supported systems.

**Files:** Modify `src/types/index.ts:49-63`

**Step 1: Replace the union**

```ts
export type EmulatorSystem =
	| "nes" // Nintendo Entertainment System (FCEUmm core)
	| "snes" // Super Nintendo (Snes9x core)
	| "gb" // Game Boy / Game Boy Color (Gambatte core)
	| "gba" // Game Boy Advance (mGBA core)
	| "n64"; // Nintendo 64 (Mupen64Plus core)
```

**Step 2: Commit**
```bash
git add src/types/index.ts
git commit -m "refactor: narrow EmulatorSystem to NES/SNES/GB/GBA/N64"
```

---

### Task 2: Narrow system maps in `game-library.ts`

**Objective:** Only the 6 consoles are scanned/served.

**Files:** Modify `src/lib/game-library.ts:36-119`

**Step 1: Replace `SYSTEM_EXTENSIONS`**

```ts
const SYSTEM_EXTENSIONS: Record<EmulatorSystem, string[]> = {
	nes: [".nes", ".fds", ".zip"],
	snes: [".sfc", ".smc", ".zip"],
	gb: [".gb", ".gbc", ".zip"],
	gba: [".gba", ".zip"],
	n64: [".n64", ".z64", ".v64", ".zip"],
};
```

**Step 2: Replace `FOLDER_TO_SYSTEM`** (keep only relevant mappings)

```ts
const FOLDER_TO_SYSTEM: Record<string, EmulatorSystem> = {
	nes: "nes",
	snes: "snes",
	"super nintendo": "snes",
	gb: "gb",
	gbc: "gb",
	"game boy": "gb",
	"game boy color": "gb",
	gba: "gba",
	"game boy advance": "gba",
	n64: "n64",
	"nintendo 64": "n64",
};
```

**Step 3: Replace `SYSTEM_NAMES`**

```ts
export const SYSTEM_NAMES: Record<EmulatorSystem, string> = {
	nes: "Nintendo Entertainment System",
	snes: "Super Nintendo",
	gb: "Game Boy / Color",
	gba: "Game Boy Advance",
	n64: "Nintendo 64",
};
```

**Step 4: Lint** `yarn lint`
**Step 5: Commit**
```bash
git add src/lib/game-library.ts
git commit -m "refactor: restrict game-library system maps to 6 consoles"
```

---

### Task 3: Narrow `SYSTEM_CORES` in systems API

**Objective:** `/api/systems` advertises only the 5 cores.

**Files:** Modify `src/app/api/systems/route.ts:22-38`

**Step 1: Replace**

```ts
const SYSTEM_CORES: Partial<Record<EmulatorSystem, string>> = {
	nes: "nes",
	snes: "snes",
	gb: "gb",
	gba: "gba",
	n64: "n64",
};
```

**Step 2: Commit**
```bash
git add src/app/api/systems/route.ts
git commit -m "refactor: systems API advertises only 5 cores"
```

---

### Task 4: Narrow `SYSTEM_TO_CORE` + remove PSP threading guard in play UI

**Objective:** Play page maps only the 5 cores; remove the now-dead PSP `SharedArrayBuffer` branch.

**Files:** Modify `src/app/play/EmulatorContent.tsx:106-121` and `:392-441`

**Step 1: Replace `SYSTEM_TO_CORE`**

```ts
const SYSTEM_TO_CORE: Record<EmulatorSystem, string> = {
	nes: "nes",
	snes: "snes",
	gb: "gb",
	gba: "gba",
	n64: "n64",
};
```

**Step 2: Delete** the `const THREADING_SYSTEMS = new Set<EmulatorSystem>(["psp"]);` line (`:395-396`) and the entire `if (requiresThreads && !hasSharedArrayBuffer) { ... return (...); }` block (`:392-441`). Play page then renders the emulator for all 5 systems unconditionally.

**Step 3: Run component tests** `yarn test src/app/components/__tests__/EmulatorContent.test.tsx`
**Step 4: Commit**
```bash
git add src/app/play/EmulatorContent.tsx
git commit -m "refactor: play page uses 5 cores, drop PSP threading guard"
```

---

### Task 5: Clean dead system entries from `GameLibrary.tsx` and `GameCard.tsx`

**Objective:** Remove `nds, segaMD, segaMS, segaGG, segaCD, psx, psp, atari2600, arcade, gamecube` from the UI label/color maps so dead systems can never render.

**Files:** Modify `src/app/components/GameLibrary.tsx:35-67` and `src/app/components/GameCard.tsx:24-54`

**Step 1: In `GameLibrary.tsx`, reduce `SYSTEM_LABELS` (and `SYSTEM_COLORS`) to only:**

```ts
const SYSTEM_LABELS: Record<EmulatorSystem, string> = {
	nes: "NES",
	snes: "SNES",
	gb: "Game Boy",
	gba: "GBA",
	n64: "N64",
};
const SYSTEM_COLORS: Record<EmulatorSystem, string> = {
	nes: "bg-red-700",
	snes: "bg-purple-700",
	gb: "bg-green-700",
	gba: "bg-blue-700",
	n64: "bg-yellow-700",
};
```

**Step 2: In `GameCard.tsx`, reduce its `SYSTEM_LABELS`/`SYSTEM_COLORS` (the same shape) to the identical 5 entries.** Delete the `gamecube` key that exists in both files.

**Step 3: Lint + typecheck** `yarn lint`
**Step 4: Commit**
```bash
git add src/app/components/GameLibrary.tsx src/app/components/GameCard.tsx
git commit -m "refactor: drop dead systems from UI label/color maps"
```

---

### Task 6: Update home page "Supported Systems" list

**Objective:** Sidebar reflects only the 6 consoles.

**Files:** Modify `src/app/page.tsx:144-158`

**Step 1: Replace the grid block**

```tsx
<div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
	<span>• NES / Famicom</span>
	<span>• SNES</span>
	<span>• Game Boy / Color</span>
	<span>• GBA</span>
	<span>• N64</span>
</div>
```

**Step 2: Commit**
```bash
git add src/app/page.tsx
git commit -m "docs: home page lists only the 6 supported consoles"
```

---

### Task 7: Delete bundled WASM cores + reports for removed systems

**Objective:** Remove the 23 WASM blobs and 5 report JSONs that correspond to systems we no longer support.

**Files:** Delete (via `git rm`) under `public/emulatorjs/data/cores/`

**Step 1: Remove the WASM data files**

```bash
git rm \
  public/emulatorjs/data/cores/desmume2015-wasm.data \
  public/emulatorjs/data/cores/desmume2015-legacy-wasm.data \
  public/emulatorjs/data/cores/desmume2015-thread-wasm.data \
  public/emulatorjs/data/cores/genesis_plus_gx-wasm.data \
  public/emulatorjs/data/cores/genesis_plus_gx-legacy-wasm.data \
  public/emulatorjs/data/cores/genesis_plus_gx-thread-wasm.data \
  public/emulatorjs/data/cores/pcsx_rearmed-wasm.data \
  public/emulatorjs/data/cores/pcsx_rearmed-legacy-wasm.data \
  public/emulatorjs/data/cores/pcsx_rearmed-thread-wasm.data \
  public/emulatorjs/data/cores/ppsspp-thread-wasm.data \
  public/emulatorjs/data/cores/stella2014-wasm.data \
  public/emulatorjs/data/cores/stella2014-legacy-wasm.data \
  public/emulatorjs/data/cores/stella2014-thread-wasm.data
```

**Step 2: Remove the report JSONs**

```bash
git rm \
  public/emulatorjs/data/cores/reports/desmume2015.json \
  public/emulatorjs/data/cores/reports/genesis_plus_gx.json \
  public/emulatorjs/data/cores/reports/pcsx_rearmed.json \
  public/emulatorjs/data/cores/reports/ppsspp.json \
  public/emulatorjs/data/cores/reports/stella2014.json
```

**Step 3: Commit**
```bash
git commit -m "refactor: delete bundled WASM cores/reports for unsupported systems"
```

> Note: `cores.json` (the EmulatorJS master catalog) is left intact — it's inert data EmulatorJS may query and removing entries there risks breaking the loader. Our UI never exposes the removed cores.

---

### Task 8: Trim the `postinstall` core downloader

**Objective:** Stop Coolify builds from re-downloading the deleted cores (shrinks image + build time).

**Files:** Modify `scripts/setup-emulatorjs.js:63-101`

**Step 1: Replace `CORE_REPORT_FILES` (lines 63-74) with only the 5:**

```js
const CORE_REPORT_FILES = [
  "cores/reports/fceumm.json",
  "cores/reports/snes9x.json",
  "cores/reports/gambatte.json",
  "cores/reports/mgba.json",
  "cores/reports/mupen64plus_next.json",
];
```

**Step 2: Replace `CORES` (lines 90-101) with only the 5:**

```js
const CORES = [
  { system: "nes", core: "fceumm", name: "NES - FCEUmm" },
  { system: "snes", core: "snes9x", name: "SNES - Snes9x" },
  { system: "gb", core: "gambatte", name: "Game Boy - Gambatte" },
  { system: "gba", core: "mgba", name: "GBA - mGBA" },
  { system: "n64", core: "mupen64plus_next", name: "N64 - Mupen64Plus" },
];
```

**Step 3: Update the trailing "Supported: ..." log line (`:317`) to the 5 systems.
**Step 4: Commit**
```bash
git add scripts/setup-emulatorjs.js
git commit -m "refactor: downloader fetches only the 5 supported cores"
```

---

### Task 9: Set upload script system scope to the 5

**Objective:** R2 uploads + local manifest pruning target only the 6 consoles.

**Files:** Modify `scripts/upload-to-r2.js:58`

**Step 1: Replace**

```js
const DEFAULT_SYSTEMS = ["nes", "snes", "gb", "gba", "n64"];
```

**Step 2: Commit**
```bash
git add scripts/upload-to-r2.js
git commit -m "refactor: R2 upload targets the 5 supported systems"
```

---

### Task 10: Prune the local library to the 5 systems

**Objective:** `data/metadata.json` (seeded to R2 as the manifest) contains only the 6 consoles.

**Files:** `data/metadata.json` (gitignored; operate locally), then re-upload.

**Step 1: Prune with a one-liner (run from repo root):**

```bash
node -e "const fs=require('fs');const p='data/metadata.json';const m=JSON.parse(fs.readFileSync(p,'utf8'));const keep=new Set(['nes','snes','gb','gba','n64']);m.games=m.games.filter(g=>keep.has(g.system));fs.writeFileSync(p,JSON.stringify(m,null,2));console.log('Kept',m.games.length,'games');"
```

**Step 2: Re-upload the pruned manifest (see Task 11's upload-manifest step) so R2 reflects the 5 systems only.
**Step 3: Commit nothing** (`data/` is gitignored) — this is an operational step.

---

### Task 11: Add R2-backed library loader (`ensureLibrary`) + manifest upload

**Objective:** On a ROM-less container, seed `data/metadata.json` from R2 when absent.

**Files:** Create `src/lib/library-source.ts`; Modify `src/lib/index.ts`; Modify `server.ts:52-57`; Create `scripts/upload-manifest.js`.

**Step 1: Write `src/lib/library-source.ts`**

```ts
import fs from "fs/promises";
import path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const METADATA_PATH = path.join(DATA_DIR, "metadata.json");
const MANIFEST_KEY = "library/manifest.json";

function getR2Client(): S3Client | null {
	const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
	if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
	return new S3Client({
		region: "auto",
		endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
	});
}

async function streamToBuffer(body: any): Promise<Buffer> {
	const chunks: Uint8Array[] = [];
	const reader = body.transformToWebStream().getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const buf = Buffer.alloc(chunks.reduce((a, c) => a + c.length, 0));
	let off = 0; for (const c of chunks) { buf.set(c, off); off += c.length; }
	return buf;
}

export async function ensureLibrary(): Promise<void> {
	await fs.mkdir(DATA_DIR, { recursive: true });
	try { await fs.access(METADATA_PATH); return; } catch { /* fall through */ }
	if (process.env.LIBRARY_SOURCE === "r2") {
		const client = getR2Client();
		const bucket = process.env.R2_BUCKET_NAME || "deejpotter";
		if (client) {
			try {
				const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: MANIFEST_KEY }));
				if (res.Body) {
					await fs.writeFile(METADATA_PATH, await streamToBuffer(res.Body));
					console.log("[Library] Seeded metadata.json from R2");
					return;
				}
			} catch (e: any) { console.warn("[Library] R2 manifest fetch failed:", e.message); }
		}
	}
	await fs.writeFile(METADATA_PATH, JSON.stringify({ games: [], lastUpdated: new Date().toISOString() }, null, 2));
	console.log("[Library] No metadata found locally or in R2 — starting empty");
}
```

**Step 2: Re-export in `src/lib/index.ts`** — add `export * from "./library-source";`

**Step 3: Update `server.ts` boot block:**

```ts
await initializeRomDirectory();
console.log("[Server] ROM directory initialized");
await ensureLibrary();                 // seed from R2 when absent
console.log("[Server] Library ready");
const { added, total } = await scanForNewRoms();   // no-op on Coolify
console.log(`[Server] Found ${total} games (${added} new)`);
```

**Step 4: Write `scripts/upload-manifest.js`** (CommonJS, mirrors `upload-to-r2.js` env loader):

```js
#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("="); if (i === -1) continue;
    const k = t.slice(0, i).trim(), v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const BUCKET = process.env.R2_BUCKET_NAME || "deejpotter";
const metaPath = path.join(__dirname, "..", "data", "metadata.json");
if (!fs.existsSync(metaPath)) { console.error("metadata.json not found — run a scan/prune first"); process.exit(1); }
(async () => {
  const body = fs.readFileSync(metaPath);
  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: "library/manifest.json", Body: body, "Content-Type": "application/json" }));
  console.log(`✅ Uploaded library manifest (${JSON.parse(body.toString()).games.length} games) to ${BUCKET}/library/manifest.json`);
})().catch((e) => { console.error(e); process.exit(1); });
```

**Step 5: Commit**
```bash
git add src/lib/library-source.ts src/lib/index.ts server.ts scripts/upload-manifest.js
git commit -m "feat: seed game library from R2 when absent locally"
```

---

### Task 12: Fix the Dockerfile

**Objective:** Reproducible install, include EmulatorJS assets, Linux-safe paths.

**Files:** Modify `Dockerfile`

**Step 1: Rewrite**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"
ENV GAMES_DIR=/data/games
ENV DATA_DIR=/data
ENV LIBRARY_SOURCE=r2

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3100
CMD ["npx", "tsx", "server.ts"]
```

**Step 2: Build locally** `docker build -t online-emu .` (confirms `public` copy + yarn install succeed).
**Step 3: Commit**
```bash
git add Dockerfile
git commit -m "fix: copy public, use yarn, linux paths in Dockerfile"
```

---

### Task 13: Expand `.env.example`

**Objective:** Document every env var the container needs.

**Files:** Modify `.env.example`

**Step 1: Append**

```
# ======================================
# Cloudflare R2 (ROM + library storage)
# ======================================
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=deejpotter

# Library source: "r2" (Coolify) or "local" (dev with disk ROMs)
LIBRARY_SOURCE=r2

# ======================================
# Coolify persistent paths
# ======================================
DATA_DIR=/data
GAMES_DIR=/data/games
PORT=3100
```

**Step 2: Commit** `git add .env.example && git commit -m "docs: document R2 + Coolify env vars"`

---

### Task 14: Update README

**Objective:** Remove references to dropped systems.

**Files:** Modify `README.md:79-89` (ROM dir example) and `:130-139` (storage table)

**Step 1: Replace the ROM directory tree (lines 80-89) with**

````markdown
```bash
# ROM directory structure
public/roms/
  nes/
  snes/
  gb/
  gba/
  n64/
```
````

**Step 2: Replace the storage table rows for Genesis/PSX/PSP (lines 137-139) — delete those three rows.**
**Step 3: Commit** `git add README.md && git commit -m "docs: README reflects the 6 supported consoles"`

---

### Task 15: Fix tests referencing removed systems

**Objective:** Test suite green after reduction.

**Files:** Modify `src/app/components/__tests__/EmulatorContent.fetch.test.tsx:44-47` (and any other test using `psp`/`nds`/`sega`/`psx`/`arcade`/`atari`).

**Step 1: Find all** `yarn test 2>&1 | grep -i "psp\|nds\|sega\|psx\|arcade\|atari" || true`
**Step 2: Replace the `psp` fixture in `EmulatorContent.fetch.test.tsx` with a `gba` game:**

```ts
id: "gba1",
system: "gba",
romPath: "gba/ROMs/test.gba",
```

**Step 3: Run full suite + lint + build:**
```bash
yarn test && yarn lint && yarn build
```
**Step 4: Commit** `git add -A && git commit -m "test: align tests with 5-system reduction"`

---

### Task 16: Local end-to-end seed + verify

**Objective:** Prove the R2-first flow works before Coolify.

**Files:** none (operational)

**Step 1: Upload ROMs (5 systems) + manifest:**
```bash
yarn install
node scripts/upload-to-r2.js                 # uploads nes/snes/gb/gba/n64 ROMs
node scripts/upload-manifest.js              # uploads data/metadata.json (pruned in Task 10)
```

**Step 2: Run with R2 as source:**
```bash
LIBRARY_SOURCE=r2 R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=deejpotter yarn build && yarn start
```
**Step 3: Verify** `/` lists only the 5 systems; clicking a game → `/api/roms/...` returns `X-ROM-Source: r2` (Network tab); a save (SRM) round-trips to `/data/games/<system>/saves/...`.

---

### Task 17: Coolify deployment

**Objective:** Ship the container with a persistent `/data` volume.

**Files:** none (Coolify UI/config)

**Step 1:** New Application → Git Repository (Dockerfile) → this repo (`main`).
**Step 2:** No build args (envs injected at runtime).
**Step 3: Environment variables:** `PORT=3100`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME=deejpotter`, `LIBRARY_SOURCE=r2`, `GAMES_DIR=/data/games`, `DATA_DIR=/data`.
**Step 4: Persistent storage** — mount a Coolify volume at container path **`/data`** (persists manifest seed, `profiles.json`, all save/SRM files).
**Step 5: Domain** — attach `roms.deejpotter.com` (or new subdomain) with automatic HTTPS (COOP/COEP already set in `next.config.ts`).
**Step 6: Verify:** `/api/status` 200; `/api/systems` lists 5; play a game end-to-end; confirm save files land under the `/data` volume.

---

## Files Likely to Change

| File | Change |
|---|---|
| `src/types/index.ts` | Narrow `EmulatorSystem` union (5 ids) |
| `src/lib/game-library.ts` | Trim `SYSTEM_EXTENSIONS`, `FOLDER_TO_SYSTEM`, `SYSTEM_NAMES` |
| `src/lib/library-source.ts` | **New** — R2-backed `ensureLibrary()` |
| `src/lib/index.ts` | Re-export new module |
| `server.ts` | Call `ensureLibrary()` before scan |
| `src/app/api/systems/route.ts` | Trim `SYSTEM_CORES` |
| `src/app/play/EmulatorContent.tsx` | Trim `SYSTEM_TO_CORE`; remove PSP threading branch |
| `src/app/components/GameLibrary.tsx` | Drop dead systems from label/color maps |
| `src/app/components/GameCard.tsx` | Drop dead systems from label/color maps |
| `src/app/page.tsx` | "Supported Systems" = 5 |
| `public/emulatorjs/data/cores/*` | **Delete** 23 WASM blobs + 5 reports |
| `scripts/setup-emulatorjs.js` | `CORES`/`CORE_REPORT_FILES` = 5 |
| `scripts/upload-to-r2.js` | `DEFAULT_SYSTEMS` = 5 |
| `scripts/upload-manifest.js` | **New** — push manifest to R2 |
| `Dockerfile` | yarn install, copy `public`, Linux paths |
| `.env.example` | Add R2 + Coolify vars |
| `README.md` | Drop psx/psp/genesis refs |
| `EmulatorContent.fetch.test.tsx` + others | Replace `psp` fixtures with `gba` |

## Tests / Validation

- `yarn test` — full Jest suite green.
- `yarn lint` — ESLint clean.
- `yarn build` — Next production build succeeds (mirrors Dockerfile `yarn build`).
- `docker build -t online-emu .` — image builds with `public` present and only 5 cores downloaded.
- Manual: only 5 systems listed; ROMs served from R2 (`X-ROM-Source: r2`); save/SRM persists to `/data`; Coolify redeploy keeps profiles + saves (volume).

## Risks, Tradeoffs, Open Questions

- **Volume is mandatory.** Without the `/data` mount, profiles + saves are lost every redeploy.
- **`data/metadata.json` is gitignored** — sourced from R2 via `LIBRARY_SOURCE=r2`; don't rely on committing it.
- **`cores.json` left intact** (EmulatorJS master catalog) — inert; removing entries risks the loader. Our UI never links to removed cores.
- **Sega/Atari/Arcade/NDS/PSX/PSP/GameCube removed** per request — re-adding is mechanical (type union + 4 maps + UI maps + 2 setup lists).
- **N64 is the heaviest core** — verify a representative N64 title loads in-browser on target devices.
- **Open question:** Curated subset or *all* 6-system ROMs on disk? Plan assumes all on disk; narrow via `upload-to-r2.js --systems` if you want a smaller set.
- **PSP/GameCube threading (COOP/COEP)** — the user mentioned "gc"; note GameCube was never in the runnable set (no libretro core here, and `gamecube` only existed as a dead UI color key, now removed). The COOP/COEP headers remain harmless for the 5 cores.
