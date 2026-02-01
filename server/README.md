# OnlineEmu Server

Self-hosted game console emulator built with Next.js 16 and EmulatorJS.

## Features

- **EmulatorJS Integration**: Runs retro console emulators in an iframe (NES, SNES, N64, PS1, etc.)
- **Sunshine Streaming**: PS2/GameCube games stream via Sunshine + moonlight-web (hardware-accelerated)
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

## PS2/GameCube Setup (Sunshine Streaming)

PS2 and GameCube games require additional setup since they use native emulators with hardware-accelerated streaming.

### Prerequisites

1. **Sunshine** - Self-hosted game streaming server
   - Download: https://github.com/LizardByte/Sunshine/releases
   - Run installer and set up admin password on first launch
   - Web UI available at https://localhost:47990

2. **moonlight-web-stream** - Browser-based Moonlight client
   - Download: https://github.com/MrCreativ3001/moonlight-web-stream/releases
   - Run the executable (serves on http://localhost:8080)
   - Pair with Sunshine: Enter PIN from Sunshine Web UI

3. **PCSX2** (for PS2 games)
   - Download: https://pcsx2.net/downloads
   - Configure BIOS and graphics settings as needed

4. **Dolphin** (for GameCube/Wii games)
   - Download: https://dolphin-emu.org/download

### Configuration

1. Go to **Settings** in OnlineEmu (gear icon in header)
2. In the **Sunshine Streaming** section:
   - Enable Sunshine Integration
   - Enter Sunshine URL: `https://localhost:47990`
   - Enter your Sunshine username and password
   - Enter moonlight-web-stream URL: `http://localhost:8080`
3. Click **Test Connection** to verify
4. Click **Save Configuration**
5. In the **External Emulators** section:
   - Enter paths to PCSX2 and Dolphin executables

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ PS2/GameCube Streaming Flow                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User clicks PS2/GC game in OnlineEmu                        │
│                    ↓                                            │
│  2. OnlineEmu registers game in Sunshine via API                │
│                    ↓                                            │
│  3. Sunshine launches PCSX2/Dolphin with game                   │
│                    ↓                                            │
│  4. Sunshine captures & encodes video (NVENC/QuickSync/AMF)     │
│                    ↓                                            │
│  5. moonlight-web-stream receives Moonlight protocol            │
│                    ↓                                            │
│  6. moonlight-web-stream converts to WebRTC                     │
│                    ↓                                            │
│  7. Browser displays video stream with controller overlay       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Troubleshooting

- **"Sunshine not configured"**: Complete settings page setup
- **Connection refused**: Ensure Sunshine is running and URL is correct
- **SSL errors**: Sunshine uses self-signed cert; browser may need to accept it first (visit https://localhost:47990)
- **No video**: Ensure moonlight-web-stream is paired with Sunshine
- **Audio issues**: Check Sunshine audio settings, ensure virtual audio device is configured

## Architecture

EmulatorJS **cannot run directly in React** (it tampers with the DOM). We use:

```text
Next.js Page → iframe → emulator.html → EmulatorJS
```

Communication between React and EmulatorJS uses `postMessage`.

## Emulation Tiers

| System | Method | Notes |
|--------|--------|-------|
| NES, SNES, GB, GBA | EmulatorJS | Full browser integration |
| N64, DS, PSP | EmulatorJS | Some games may be slow |
| PS1, Genesis, Saturn | EmulatorJS | Good compatibility |
| PS2 | Sunshine + PCSX2 | Requires setup |
| GameCube/Wii | Sunshine + Dolphin | Requires setup |

## Learn More

- [EmulatorJS Docs](https://emulatorjs.org/docs)
- [Sunshine Docs](https://docs.lizardbyte.dev/projects/sunshine)
- [moonlight-web-stream](https://github.com/MrCreativ3001/moonlight-web-stream)
- [Next.js Documentation](https://nextjs.org/docs)
