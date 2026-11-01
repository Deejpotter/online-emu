# Improvement plan

Small, testable improvements shipped one at a time. Workflow per item:
branch from `main`, implement with a test, run `jest`, `eslint` and
`next build`, PR into `dev`, merge, then PR `dev` into `main`.

## Release flow

1. Feature branch from `main`; PR into `dev` once lint, tests and build pass (CI runs on PRs into `dev` and `main`).
2. Merging `dev` deploys staging (`online-emu-staging` in Coolify, `https://roms-staging.deejpotter.com`, `R2_SAVE_PREFIX=online-emu-staging`). Run `npm run verify:deploy https://roms-staging.deejpotter.com --ref origin/dev`.
3. PR `dev` into `main`; Coolify deploys production. Run `npm run verify:deploy https://roms.deejpotter.com --ref origin/main`.
4. From the cloud session, prefix the verify command with `NODE_USE_ENV_PROXY=1` so Node's fetch uses the proxy.

## Shipped

| # | Change | PRs |
|---|--------|-----|
| 1 | Library scan feedback uses toasts instead of `alert()`; grid/list view and sort mode saved in localStorage | #4, #5 |
| 2 | `/` focuses library search, Escape clears it then leaves the field | #6, #7 |
| 3 | System filter remembered with view and sort prefs | #10, #11 |
| 4 | Search and system filter synced to the URL (`?q=&system=`) so views can be bookmarked or shared | #12, #13 |
| 5 | "Continue playing" row of the 6 most recently played games on the unfiltered library view | #14, #15 |
| 6 | Save guard: automatic saves wait until the server save has been restored; strict iframe message origin check | #16, #17 |
| 7 | Back button saves before leaving; warnings for repeated save failures and when automatic saving is off; player page only accepts same-origin commands | #18, #19 |
| 8 | Deploy fix: `/save-guard.js` was redirected to `/profiles` in production (turning automatic saves off for everyone); fonts bundled via `geist` so builds no longer fetch Google Fonts | #20, #21 |
| 9 | Release pipeline: CI (lint, test, build) on PRs into `dev` and `main`; `npm run verify:deploy <url>` post-deploy check; `R2_SAVE_PREFIX` so staging keeps its own saves | #22 |
| 10 | `verify:deploy` ignores the bot-detection script Cloudflare injects into HTML; staging app `online-emu-staging` created and verified | #23, #24 |
| 11 | Saves/SRM APIs reject unknown profile ids (401); EmulatorJS pinned to 4.2.3 (CDN files match the committed copy); Docker build uses the image's yarn instead of fetching it; CI typechecks; 0 `tsc` errors, 0 lint warnings, 0 `act` warnings | #26, #27 |
| 12 | Manual save slots 1 to 3 on the play page (slot 0 stays the automatic save); the chosen slot is remembered; loading an empty slot is reported | see PR |

## Next up (candidates)

### Emulator stability (priority)

1. **Smoke test the player in CI**: a Playwright check that loads `/play` with a test ROM and confirms the `ready` message, once a legal test ROM and cores are available in CI.
2. **Closing the tab still can't guarantee a save**: `pagehide`/`beforeunload` uploads can be cancelled by the browser. The Back button now saves first; closing the tab relies on the 60s auto-save and tab-hidden save.

### Library and code health

1. **Favourites**: star games in the library and filter to them. Needs per-profile storage (a `favourites` table or column), so it is an API plus a migration.
2. **Save slot overview**: show which manual slots hold a save (needs a list endpoint for `/api/saves`).

## Notes

- After each merge to `main`, check the Coolify deployment actually finished (`/api/v1/deployments/applications/<uuid>`). A failed deploy leaves production on the old build while `main` looks shipped. Two deploys on 2026-10-31/11-01 failed on server DNS (webhook host lookup, Google Fonts fetch).
- Any new file in `public/` that the player page loads must be added to `publicPaths` in `src/middleware.ts`, or it is redirected to `/profiles` for requests without a profile cookie (covered by `src/lib/__tests__/middleware.test.ts`).

- There was no `dev` branch before this work; it was created from `main`.
- Day Planner tracking is not connected in the cloud session, so this file is the record for now.
