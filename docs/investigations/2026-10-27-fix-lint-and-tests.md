# Fix lint gate and failing API tests

- Date: 2026-10-27
- Investigator: Claude Code (Opus 5.5)
- Status: code fixed; live site restored 2026-10-27 (see section 9)

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

## 9. Live site follow-up (same day)
- Hypothesis "Coolify token expired": **wrong**. `COOLIFY_API_TOKEN` in `krasus/.env` works; only the Coolify MCP server rejected it (stale copy).
- Cause of the 503: online-emu was not a Coolify resource. It had been run by hand with `scripts/deploy-coolify-docker.sh`, and the NUC had no containers or volumes for it.
- Fix: created Coolify app `tgxuc2kku2kjdlm8um5xd9kb` (GitHub App, dockercompose, `main`), set R2 and Postgres env from `.env.coolify`, added domains roms./emu., deployed.
- First deploy failed: `yarn install` got ESOCKETTIMEDOUT from the registry while the NUC was at load ~25. The retry succeeded (yarn 704 s, next build 346 s).
- Container was healthy but still 503: it was not on the `coolify` network. Joined it with `docker network connect` and set `connect_to_docker_network: true` so later deploys keep it.
- Verified: `/api/status` 200 on both hosts, `/api/systems` 200, a GB ROM returns 200 with `X-ROM-Source: r2`.

## 10. Faster deploys
- Dockerfile: BuildKit cache mounts for the yarn cache and `.next/cache`, `--prefer-offline --network-timeout 600000`, no `apk add wget` (BusyBox has it). `.dockerignore` drops tests, docs, scripts and compose files.
- **Not measured.** Two timed test builds on the NUC ran alongside other apps' Coolify builds and hit the 25 min limit, so they say nothing about the cache. The test build was cancelled and its image removed.
- Not changed: env vars are flagged build-time in Coolify. Constant ARG values do not break the layer cache, so this is not the slowdown; turning off build-time for the secrets is still worth doing for hygiene.

## 11. Found in passing (not changed)
- Day Planner (tasks.deejpotter.com) returns 503. Its container is "unhealthy" because its health check calls `curl`, which is not in its image. The NUC also shows ~560 zombie processes. Separate repo, not touched.

## 12. Follow-up 2026-10-28: ERR_FAILED in the browser, then 503
- Server checks were 200, but Chrome showed ERR_FAILED. Cause: `public/sw.js` precached `/`, which redirects to `/profiles`. Chrome rejects a redirected response served for a navigation. curl has no service worker, so it never saw this. Fix (PR #1): pages are network-first, redirects are never cached, cache name bumped to `online-emu-v2` so old caches are deleted.
- The deploy of PR #1 then returned 503: the app was "unhealthy". My Dockerfile change removed `apk add wget`, and BusyBox wget resolves `localhost` to `::1` without falling back to IPv4. Fix (PR #2): health check uses `127.0.0.1`.
- Deploy times: before 704 s yarn + 346 s build (~25 min total); PR #1 deploy 140 s yarn + 260 s build (~17 min, including a 395 s image export); PR #2 deploy 95 s total.
- Verified in a browser with the v2 worker active: `/` redirects to the profile picker, cache `online-emu-v2` only.
- Note: the profile list is empty. The new Postgres volume started blank because the old stack's data volume no longer exists on the NUC. Saves live in R2 by profile ID, so recreating a profile does not bring old saves back unless the ID matches.
