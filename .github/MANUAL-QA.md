# Manual QA Checklist

Run after deploy or significant emulator changes.

**Last production QA:** 2026-07-26 on https://roms.deejpotter.com (Docker Compose: app + Postgres, R2 saves)

## Automated pre-checks

```bash
yarn test                    # 66 tests including save-storage
yarn verify:r2
yarn build
```

Production curl checks:

```bash
curl -s https://roms.deejpotter.com/api/status
curl -s https://roms.deejpotter.com/api/systems          # 5 systems
curl -I "https://roms.deejpotter.com/api/roms/GB/ROMs/4-in-1%20Fun%20Pak.zip"  # X-ROM-Source: r2
# POST save then: curl -sI .../api/saves/... -H "Cookie: profileId=..."  # X-Save-Source: r2
```

## Storage verification (Compose deploy)

| Check | Method | 2026-07-26 |
|-------|--------|------------|
| Profiles in Postgres | POST `/api/profiles` → 201 with UUID | Pass |
| Saves in R2 | POST save → `source: r2` in JSON; GET → `X-Save-Source: r2` | Pass |
| ROMs from R2 | `X-ROM-Source: r2` | Pass |
| Library from R2 | 3744 games on `/` | Pass (prior session) |

## Browser-automated vs manual

| Check | Method | Status |
|-------|--------|--------|
| Profiles list/create | Browser / API | Pass |
| Game library | Browser | Pass |
| Play page Save/Load buttons | Browser | Pass |
| PWA `display: standalone` | curl manifest | Pass |
| Emulator canvas renders | Browser iframe | Partial — MCP cannot access iframe |
| In-game SRM save/restore | Manual | Pending |
| 60s auto-save state | Manual | Pending |

## Phase 7 — EmulatorJS bug fixes

- [ ] No repeated "Translation not found" warnings in DevTools
- [x] New profile GBA game — no "Error downloading game state" banner
- [ ] Emulator loads within 30s (iframe visual check)
- [x] Save/Load buttons visible on parent toolbar
- [ ] In-game SRM saves and restores after reload

## R2 / Coolify Compose

- [x] `/api/status` returns 200
- [x] `/api/systems` lists 5 systems
- [x] Game library shows titles
- [x] ROM requests return `X-ROM-Source: r2`
- [x] Save requests return `X-Save-Source: r2`
- [x] Profiles persist in Postgres (survives app container restart)

## Fresh profile path

- [x] Create profile with no prior saves
- [x] Launch game — play page loads without error banner
- [ ] Play, save in-game, reload — progress persists (manual / iframe)
