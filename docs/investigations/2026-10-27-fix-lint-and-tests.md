# Fix lint gate and failing API tests

- Date: 2026-10-27
- Investigator: Claude Code (Opus 5.5)
- Status: code fixed; live site down, not resolved (see open items)

## 1. What was asked
"Fix the app." No specific symptom given, so the manual gate (lint, test, build) and the live site were checked.

## 2. What was checked
- `npm run lint`: 125 errors, 18 warnings.
- `npm test`: 4 suites failed (saves/srm API), 62/66 tests passing.
- `npm run build`: clean.
- `https://roms.deejpotter.com` and `https://emu.deejpotter.com` `/api/status`: both 503 "Site not found".
- Coolify MCP: `Unauthenticated`.

## 3. Evidence
- Test failures: GET returned a 0-byte body. Jest runs in `jsdom`, which has no `Response`, so the fallback in `jest.env.js` is used. That fallback's `arrayBuffer()` ignores `Uint8Array` bodies. The route code was fine.
- Lint: ~118 errors were `no-require-imports`/`no-explicit-any` in CommonJS `scripts/`, `jest.env.js` and `__tests__`. 4 were real errors in `EmulatorContent.tsx`, plus 1 `prefer-const`.

## 4. What was changed
- API test files under `src/app/api/{saves,srm}/__tests__` now use `/** @jest-environment node */` (real Fetch API).
- `eslint.config.mjs`: turned off `no-require-imports` and `no-explicit-any` for scripts, `jest.env.js` and `__tests__`.
- `EmulatorContent.tsx`: typed the `srmSaveComplete` payload, fixed the garbled ❌ emoji.
- `saves-api.test.ts`: `let` changed to `const`.

## 5. Deliberately not changed
- The `<a href="/">` back links in `EmulatorContent.tsx` stay as full page loads (lint rule disabled on those lines). A client-side `<Link>` would leave the EmulatorJS globals and audio context running.
- The `jest.env.js` `Response` polyfill was left alone. The node environment avoids it.
- The 18 lint warnings were left; they are unused vars in tests.

## 6. Verification
lint 0 errors; jest 66/66; `next build` clean.

## 7. Open items
- The live site returns 503 on both hostnames. The Coolify MCP token is invalid, so the deploy could not be checked. Needs a new Coolify API token, then a check of app status and logs.
- Saves still need a persistent `/data` volume, or `SAVE_STORAGE=r2` (see `.hermes/plans/2026-07-11_135000-fix-games-saves.md`).

## 8. Reproduce
```
npm run lint
npx jest
npm run build
curl -s -o /dev/null -w "%{http_code}" https://roms.deejpotter.com/api/status
```
