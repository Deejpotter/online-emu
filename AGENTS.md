# online-emu - agent guide

Self-hosted retro game emulator (EmulatorJS). Next.js server, library indexed on
the home PC, deployed on Coolify. `roms.deejpotter.com` when live.

## Commands

```powershell
npm run dev          # local dev
npm run build        # production build
npm run test         # tests
npm run lint         # lint gate
npm run scan:library # rescan the ROM library
npm run verify:r2    # check R2 connectivity
```

## Rules

- ROMs and saves are personal data. Never commit them and never upload them to a
  public bucket.
- R2 credentials come from `C:\Users\Deej\Repos\krasus\.env`.
- Manual gate: lint and tests passing, build clean.

Global rules: `C:\Users\Deej\AGENTS.md`.
