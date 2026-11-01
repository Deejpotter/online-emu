# Improvement plan

Small, testable improvements shipped one at a time. Workflow per item:
branch from `main`, implement with a test, run `jest`, `eslint` and
`next build`, PR into `dev`, merge, then PR `dev` into `main`.

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
| 8 | Deploy fix: `/save-guard.js` was redirected to `/profiles` in production (turning automatic saves off for everyone); fonts bundled via `geist` so builds no longer fetch Google Fonts | see PR |

## Next up (candidates)

### Emulator stability (priority)

1. **Pin EmulatorJS**: `scripts/setup-emulatorjs.js` downloads from the `stable` channel. Production uses the committed 4.2.3 files, but re-running setup can silently change the emulator. Pin to `4.2.3` once the CDN path is confirmed (the CDN is blocked from the cloud session).
2. **Smoke test the player**: a Playwright check that loads `/play` with a test ROM and confirms the `ready` message, once a legal test ROM and cores are available in CI.
3. **Closing the tab still can't guarantee a save**: `pagehide`/`beforeunload` uploads can be cancelled by the browser. The Back button now saves first; closing the tab relies on the 60s auto-save and tab-hidden save.

### Library and code health

1. **Fix pre-existing type errors** in test files (`tsc --noEmit` reports 6, Buffer/Uint8Array typing in API tests).
2. **Clean lint warnings** (unused variables in library tests).
3. **Wrap async state updates in tests with `act`** to remove noisy React warnings in EmulatorContent tests.

## Notes

- After each merge to `main`, check the Coolify deployment actually finished (`/api/v1/deployments/applications/<uuid>`). A failed deploy leaves production on the old build while `main` looks shipped. Two deploys on 2026-10-31/11-01 failed on server DNS (webhook host lookup, Google Fonts fetch).
- Any new file in `public/` that the player page loads must be added to `publicPaths` in `src/middleware.ts`, or it is redirected to `/profiles` for requests without a profile cookie (covered by `src/lib/__tests__/middleware.test.ts`).

- There was no `dev` branch before this work; it was created from `main`.
- Day Planner tracking is not connected in the cloud session, so this file is the record for now.
