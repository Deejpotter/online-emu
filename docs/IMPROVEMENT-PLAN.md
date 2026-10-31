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
| 6 | Save guard: automatic saves wait until the server save has been restored; strict iframe message origin check | see PR |

## Next up (candidates)

### Emulator stability (priority)

1. **Pin EmulatorJS**: `scripts/setup-emulatorjs.js` downloads from the `stable` channel. Production uses the committed 4.2.3 files, but re-running setup can silently change the emulator. Pin to `4.2.3` once the CDN path is confirmed (the CDN is blocked from the cloud session).
2. **Unload saves may be cut off**: `pagehide`/`beforeunload` fire plain `fetch` POSTs that browsers can cancel. `keepalive` caps bodies at 64 KB, smaller than most save states, so the real fix is saving on the in-app Back button before navigating.
3. **Save failure visibility**: automatic saves that fail only log to the console. Surface a toast in the parent page after repeated failures.
4. **Restore failure visibility**: if the server is unreachable at start, automatic saves now stay off for the session (safe), but the player is not told. Show a warning toast.
5. **Smoke test the player**: a Playwright check that loads `/play` with a test ROM and confirms the `ready` message, once a legal test ROM and cores are available in CI.

### Library and code health

1. **Fix pre-existing type errors** in test files (`tsc --noEmit` reports 8, mostly Buffer/Uint8Array typing and a duplicate React import).
2. **Clean lint warnings** (unused variables in library tests).
3. **Wrap async state updates in tests with `act`** to remove noisy React warnings in EmulatorContent tests.

## Notes

- There was no `dev` branch before this work; it was created from `main`.
- Day Planner tracking is not connected in the cloud session, so this file is the record for now.
