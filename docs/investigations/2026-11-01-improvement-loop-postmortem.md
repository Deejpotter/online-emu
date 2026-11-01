# Post mortem: improvement loop, 2026-10-31 to 2026-11-01

- Dates: 2026-10-31 to 2026-11-01
- Author: Claude Code (cloud session)
- Status: all work merged to `main`; production and staging verified with `npm run verify:deploy`

## 1. What was asked
Run a continuous loop: think of an improvement, plan it, merge it through `dev` into `main`, then pick the next one. Mid-way the brief widened to emulator stability, then to Coolify access, and finally to a proper release flow: test, merge to `dev`, verify staging, merge to `main`.

## 2. Timeline

| When (UTC) | What happened |
|---|---|
| 10-31 04:30 | No `dev` branch existed; created from `main`. Loop started. |
| 10-31 04:37 to 21:22 | Library improvements shipped (#4 to #15): toasts, saved prefs, `/` shortcut, URL filters, Continue playing row. |
| 10-31 21:30 | User asked about emulator stability. Audit of `public/emulator.html` found automatic saves could overwrite the server save. Save guard shipped (#16, #17). |
| 10-31 22:34 | Save-before-leaving and save warnings merged (#18, #19). Coolify deploy of `f7e280a` **failed** ("Webhook URL host could not be resolved"). Not noticed: no Coolify access yet. |
| 11-01 ~04:00 | Coolify access given. Whole site (app and Coolify) briefly returned Cloudflare 1033 (tunnel down), then recovered. |
| 11-01 04:20 | Found production stuck on `9f04575` and `/save-guard.js` redirected to `/profiles` in production. Redeploy failed: `next/font` could not fetch Geist from Google Fonts. |
| 11-01 04:27 | Fix merged (#20, #21): middleware allows `/save-guard.js`; fonts bundled with `geist`. Deploy failed again: `EAI_AGAIN registry.npmjs.org`. Retry stuck behind another app's hung build, then dropped. |
| 11-01 07:41 to 08:50 | Queue moved again. Production `eb9e7eb` deployed. Release pipeline merged to `dev` (#22). Staging app `online-emu-staging` created and verified. |
| 11-01 08:57 | `verify:deploy` Cloudflare fix merged to `dev` (#23); `dev` promoted to `main` (#24). |

## 3. What shipped

| Area | Change | PRs |
|---|---|---|
| Library | Scan feedback as toasts; grid/list, sort and system filter remembered | #4, #5, #10, #11 |
| Library | `/` focuses search, Escape clears it | #6, #7 |
| Library | Search and system filter in the URL (`?q=&system=`) | #12, #13 |
| Library | Continue playing row (6 most recently played) | #14, #15 |
| Emulator | Save guard: automatic saves wait until the server save has been restored | #16, #17 |
| Emulator | Back saves before leaving; warnings for repeated save failures and when auto-save is off; same-origin messaging both ways | #18, #19 |
| Deploy | `/save-guard.js` public in middleware; fonts bundled (`geist@1.8.1`) | #20, #21 |
| Release | CI (lint, test, build) on `dev` and `main`; `npm run verify:deploy`; `R2_SAVE_PREFIX` | #22, #23, #24 |
| Infra | Coolify: `staging` environment and `online-emu-staging` app (`dev` branch, `https://roms-staging.deejpotter.com`, own Postgres, `R2_SAVE_PREFIX=online-emu-staging`) | n/a |
| Docs | `docs/IMPROVEMENT-PLAN.md` (plan, release flow, notes) | #8, #9 and each later PR |

Tests went from 69 to 97. `tsc --noEmit` errors went from 8 to 6.

## 4. Incidents

### 4.1 Automatic saves could overwrite the real save (found and fixed)
- **Impact:** a player could lose a save state or in-game save. Blur, tab-hidden, page-close and the 60s timer uploaded without checking that the server copy had been restored. Clicking the parent page in the first 0.5 to 1.5s, or any restore error, let a freshly booted state or empty SRM replace the server copy.
- **Fix:** `public/save-guard.js` (#16). Automatic saves only run once the restore has loaded or the server has returned 404.
- **Not observed in production data**; found by reading the code.

### 4.2 Automatic saves off for every player (introduced by 4.1's fix)
- **Impact:** from the #16 deploy (10-31 21:37) until `eb9e7eb` went live (11-01 ~07:56), automatic saves did nothing in production. Manual saves and in-game memory card writes still worked. No saves were lost, because the fallback blocks rather than writes.
- **Cause:** `src/middleware.ts` only lets listed paths through without a profile cookie. `/save-guard.js` was new and not listed, so it was redirected to `/profiles`. The player page received HTML, `window.SaveGuard` was undefined, and the fail-safe path blocked every automatic save.
- **Why it wasn't caught:** jest tested the guard in isolation, and the build doesn't exercise middleware. Nothing loaded the deployed page. The fail-safe fallback (added on purpose) also hid the failure from players.
- **Fix:** #20 adds the path and a middleware test that fails on the old code. #22 adds `verify:deploy`, which checks every player asset is served without a redirect.

### 4.3 Production stuck on an old build for about 9 hours
- **Impact:** #18/#19 (save before leaving, save warnings) and the 4.2 fix were in `main` but not live from 10-31 22:34 to 11-01 ~07:56.
- **Causes:**
  - The build server's DNS failed repeatedly: the webhook host, `fonts.googleapis.com`, then `registry.npmjs.org`.
  - The server runs one build at a time, so a hung build for another app ("My Reader - Staging") blocked the queue and our retry was dropped.
  - Merges were reported as shipped without checking that the deploy finished. Coolify wasn't reachable from the session until 11-01.
- **Fix:**
  - Fonts no longer need a network fetch at build time (#20).
  - `verify:deploy` confirms the live `emulator.html` matches the expected commit (#22, #23).
  - The plan doc now says to check the deploy status after each merge.
- **Still open:** the server's DNS reliability and the single build slot (see section 7).

### 4.4 Site unreachable (Cloudflare 1033)
- Around 11-01 04:00, `roms`, `emu` and `coolify.deejpotter.com` all returned 1033 (tunnel not connected). It recovered without changes from this session. The cause is outside the repo, probably the host or `cloudflared`.

## 5. What went well
- Small, testable changes, each with a test, and the gate (lint, test, build) run before every merge.
- The stability audit found a real data-loss risk that the library work would never have surfaced.
- The fail-safe fallback in 4.2 meant a deploy mistake cost convenience, not saves.
- Once Coolify was reachable, the deploy logs pointed straight to root causes. The new `verify:deploy` reproduced both live problems before they were fixed.
- Staging keeps its saves apart from production: own database, own R2 prefix. This was checked with a real round trip, and the test data was removed.

## 6. What went wrong
- **Shipped without checking production.** For most of the loop, "merged to `main`" was reported as done. CI only ran on PRs into `main`, so feature PRs into `dev` had no CI, and nothing confirmed deploys.
- **Library polish first.** The first five rounds polished the library page while the emulator, the core of the app, had the save bugs. The user's question redirected the work; it should have started there.
- **Untested in a browser.** None of the emulator changes were run against a real ROM, because there is no ROM or EmulatorJS CDN in the cloud session. Syntax checks and unit tests aren't a play session.
- **Merged at speed.** PRs were merged seconds after opening, before CI or bots ran. That was fine while CI didn't run on `dev`, but it would have skipped CI once it did.
- **Small slips:**
  - A test-file edit broke the next round's test (URL state leaking between tests).
  - A shell script misread the profile id during the staging check, so one test save used profile id `None`. It was cleaned up.

## 7. Follow-ups

| # | Item | Owner |
|---|---|---|
| 1 | Fix DNS on the Coolify host (`/etc/docker/daemon.json` `"dns": ["1.1.1.1","8.8.8.8"]` or host resolver) and consider raising concurrent builds above 1 | Deej |
| 2 | Manually play a game on staging and production: start with an existing save ("SAVE RESTORED"), switch tabs, press Back, reopen | Deej |
| 3 | Reject unknown `profileId` cookies in `/api/saves` and `/api/srm` (staging accepted `None`) | next loop |
| 4 | Pin EmulatorJS to `4.2.3` in `scripts/setup-emulatorjs.js` once the CDN path is confirmed | next loop |
| 5 | Playwright smoke test of `/play` with a legal test ROM | next loop |
| 6 | Remaining 6 `tsc` errors (Buffer/Uint8Array in API tests), lint warnings, `act` warnings | next loop |
| 7 | Corepack fetches `yarn@latest` on every build (`EAI_AGAIN` hit it); pin the yarn version via `packageManager` in `package.json` | next loop |

## 8. Process changes now in place
1. Feature branch from `main`, then PR into `dev`. CI runs lint, test and build, and the PR merges only when it passes.
2. Merging into `dev` deploys staging. Run `npm run verify:deploy https://roms-staging.deejpotter.com --ref origin/dev`.
3. PR `dev` into `main`; Coolify deploys production. Run `npm run verify:deploy https://roms.deejpotter.com --ref origin/main`.
4. In the cloud session, prefix with `NODE_USE_ENV_PROXY=1`.
5. Any new file in `public/` that the player page loads must be added to `publicPaths` in `src/middleware.ts`.
