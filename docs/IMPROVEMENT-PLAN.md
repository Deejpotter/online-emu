# Improvement plan

Small, testable improvements shipped one at a time. Workflow per item:
branch from `main`, implement with a test, run `jest`, `eslint` and
`next build`, PR into `dev`, merge, then PR `dev` into `main`.

## Shipped

| # | Change | PRs |
|---|--------|-----|
| 1 | Library scan feedback uses toasts instead of `alert()`; grid/list view and sort mode saved in localStorage | #4, #5 |
| 2 | `/` focuses library search, Escape clears it then leaves the field | #6, #7 |
| 3 | System filter remembered with view and sort prefs | see PR |

## Next up (candidates)

1. **Continue playing row**: show recently played games at the top of the library (needs last-played data from saves or local history).
2. **Search in URL**: sync search query and system filter to the query string so a filtered view can be bookmarked or shared.
3. **Fix pre-existing type errors** in test files (`tsc --noEmit` reports 8, mostly Buffer/Uint8Array typing and a duplicate React import).
4. **Clean lint warnings** (unused variables in library tests).
5. **Wrap async state updates in tests with `act`** to remove noisy React warnings in EmulatorContent tests.

## Notes

- There was no `dev` branch before this work; it was created from `main`.
- Day Planner tracking is not connected in the cloud session, so this file is the record for now.
