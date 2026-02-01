# Online Emulator

Self-hosted game console emulator that runs on your PC and streams to your phone for remote play with on-screen or physical controller support.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your PC (Server)                         │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   Next.js App   │    │   Streaming Browser Window       │ │
│  │   (Port 3000)   │───▶│   - EmulatorJS runs here        │ │
│  │   - ROM API     │    │   - Canvas capture → WebRTC     │ │
│  │   - WebSocket   │    │   - All emulation on PC         │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│           │                          │                       │
│           │ Socket.IO                │ WebRTC Video          │
└───────────┼──────────────────────────┼───────────────────────┘
            │                          │
      ┌─────▼──────────────────────────▼─────┐
      │          Your Phone (Client)          │
      │  ┌─────────────────────────────────┐ │
      │  │     Expo/React Native App       │ │
      │  │  - Video display (thin client)  │ │
      │  │  - Virtual gamepad overlay      │ │
      │  │  - Bluetooth controller input   │ │
      │  │  - Sends inputs via WebSocket   │ │
      │  └─────────────────────────────────┘ │
      └───────────────────────────────────────┘
```

## Why This Architecture?

- **All processing on PC** - Emulation runs on your powerful PC, not your phone
- **Phone is just a display** - Receives video stream, sends controller inputs
- **Supports powerful consoles** - Can run PS1, N64, and more without taxing your phone
- **Low phone battery/memory usage** - Video decoding is hardware-accelerated

## Quick Start

### Server Setup

```bash
cd server
npm install          # Also downloads EmulatorJS automatically
npm run dev          # Starts at http://localhost:3000
```

### Mobile Setup

```bash
cd mobile
npm install
npx expo start       # Scan QR code with Expo Go app
```

### Adding Games

Place ROM files in the appropriate system folder:

```
server/public/roms/
├── nes/           # .nes files
├── snes/          # .sfc, .smc files
├── gb/            # .gb files
├── gba/           # .gba files
├── n64/           # .n64, .z64 files
├── psx/           # .bin/.cue, .iso files
└── ...
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Server** | Next.js 16 + TypeScript |
| **Emulation** | EmulatorJS (WebAssembly/libretro) |
| **Streaming** | WebRTC (simple-peer) |
| **Real-time** | Socket.IO |
| **Discovery** | mDNS (bonjour-service) |
| **Mobile** | Expo + React Native |
| **Controls** | react-native-gesture-handler |

## Supported Systems

| System | Core | Status |
|--------|------|--------|
| NES | FCEUmm | ✅ Ready |
| SNES | Snes9x | ✅ Ready |
| Game Boy / Color | Gambatte | ✅ Ready |
| Game Boy Advance | mGBA | ✅ Ready |
| N64 | Mupen64Plus | ✅ Ready |
| PlayStation | PCSX ReARMed | ✅ Ready |
| Sega Genesis | Genesis Plus GX | ✅ Ready |

## Project Structure

```
online-emu/
├── server/                 # Next.js server (PC)
│   ├── src/
│   │   ├── app/           # Next.js App Router
│   │   │   ├── api/       # REST API endpoints
│   │   │   ├── play/      # Emulator page
│   │   │   └── stream/    # Streaming page (WebRTC source)
│   │   └── lib/           # Shared utilities
│   ├── public/
│   │   ├── emulatorjs/    # Self-hosted EmulatorJS
│   │   └── roms/          # Game files (user-provided)
│   └── server.ts          # Custom server with Socket.IO
│
├── mobile/                 # Expo app (Phone)
│   ├── src/
│   │   ├── components/    # UI (VirtualController, etc.)
│   │   ├── screens/       # App screens
│   │   ├── services/      # WebRTC, Socket clients
│   │   └── hooks/         # Custom React hooks
│   └── app/               # Expo Router screens
│
└── .github/
    ├── copilot-instructions.md   # AI coding guidelines
    └── todos.md                   # Development progress
```

## Development

See [.github/todos.md](.github/todos.md) for current development status and roadmap.

## Legal Notice

This project does not include any copyrighted game files. You must provide your own legally obtained ROM files.
