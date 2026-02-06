# OnlineEmu Server

Self-hosted game console emulator built with Next.js 16 and EmulatorJS.

## Features

- **EmulatorJS Integration**: Runs retro console emulators in an iframe (NES, SNES, N64, PS1, etc.)
- **PWA Support**: Install as a Progressive Web App on any device
- **Auto-Start Games**: Games start automatically when selected (no extra clicks)
- **Responsive Scaling**: Emulator canvas scales to fit any screen size
- **Gamepad Support**: Browser Gamepad API auto-detects controllers
- **Server-Side Saves**: Save states and SRM files stored on the server
- **Local Profiles**: Simple Netflix-style profile system (no authentication)

## Getting Started

```bash
npm install      # Installs deps + downloads EmulatorJS
npm run dev      # Start dev server (localhost:3000)
```

Open [http://localhost:3000](http://localhost:3000) to play games locally.

## PWA Installation

Install OnlineEmu on your phone or tablet:

1. Open `http://localhost:3000` (or your server's URL) in Chrome/Safari
2. Tap the browser menu → "Add to Home Screen"
3. The app installs and runs in standalone mode (no browser chrome)

The PWA caches EmulatorJS assets for offline use.

## Adding Games

1. Place ROM files in `public/roms/{system}/`
2. Click "Scan for ROMs" in the library
3. Games appear automatically with system detection

### Supported Systems

| System | Folder | Extensions |
|--------|--------|------------|
| NES | `nes/` | .nes |
| SNES | `snes/` | .sfc, .smc |
| Game Boy | `gb/` | .gb |
| Game Boy Advance | `gba/` | .gba |
| N64 | `n64/` | .z64, .n64 |
| Nintendo DS | `nds/` | .nds |
| PlayStation | `psx/` | .bin, .cue, .iso |
| PSP | `psp/` | .iso, .cso |
| Genesis | `segaMD/` | .md, .bin |
| Arcade | `arcade/` | .zip |

## Architecture

EmulatorJS **cannot run directly in React** (it tampers with the DOM). We use:

```text
Next.js Page → iframe → emulator.html → EmulatorJS
```

Communication between React and EmulatorJS uses `postMessage`.

## Keyboard Controls

| Key | Action |
|-----|--------|
| Arrow keys | D-Pad |
| Z | A button |
| X | B button |
| A | X button |
| S | Y button |
| Q | L shoulder |
| W | R shoulder |
| Enter | Start |
| Shift | Select |

## Production Deployment

For production deployment on a Vultr VPS:

```bash
# Build the application
npm run build

# Start with PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# The server runs on port 3000 by default
# Configure Nginx as reverse proxy for SSL/domain mapping
```

**Recommended Vultr Plan**: Standard ($12/mo)

- 80GB SSD storage (sufficient for 200+ retro games)
- 4GB RAM
- 3TB monthly bandwidth

See the main [README.md](../README.md) for full deployment instructions.

## Learn More

- [EmulatorJS Docs](https://emulatorjs.org/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [PM2 Guide](https://pm2.keymetrics.io/docs/)
