# Manual QA Checklist

Run after deploy or significant emulator changes. Automated checks (`yarn test`, `yarn verify:r2`) cover API and library logic; these steps require a browser.

## Automated pre-checks

```bash
yarn test
yarn verify:r2          # R2 manifest + ROM API (requires .env R2 creds)
yarn build
```

## Phase 7 — EmulatorJS bug fixes

- [ ] Open DevTools on a game page — no repeated "Translation not found" warnings
- [ ] Open a GBA game (new profile, no prior saves) — no "Error downloading game state" banner
- [ ] Emulator loads within 30s (no black screen timeout)
- [ ] Manual save/load state buttons work
- [ ] In-game save (SRM) saves and restores after reload

## Save automation

- [ ] Auto-save state every 60s — check browser console for `[Server Save]` logs after ~1 min of play
- [ ] Auto-load save state on game start — resume position restores for a game with an existing save
- [ ] SRM auto-restore on game start — in-game save progress restores after reload

## PWA

- [ ] On mobile (or Chrome DevTools device mode): visit site over HTTPS
- [ ] "Install app" / "Add to Home Screen" prompt appears
- [ ] Installed app opens in standalone mode at `/`
- [ ] Game library and play flow work from installed PWA

## R2 / Coolify deployment

- [ ] `/api/status` returns 200
- [ ] `/api/systems` lists exactly 5 systems
- [ ] Game library shows titles (not empty)
- [ ] Network tab: ROM request returns `X-ROM-Source: r2`
- [ ] Save/SRM files appear under `/data/games/{system}/saves/{profileId}/` on the volume

## Fresh profile path

- [ ] Create a new profile with no prior saves
- [ ] Launch a game — loads without errors
- [ ] Play, save in-game, reload — progress persists
