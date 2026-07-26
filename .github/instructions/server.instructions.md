---
applyTo: "src/**/*.ts,src/**/*.tsx,server.ts"
---

# Server Development Instructions

## Next.js App Router Patterns

### API Routes

- Place in `app/api/[route]/route.ts`
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Use `Response.json()` for JSON responses
- Validate inputs with Zod schemas

### Server Components vs Client Components

- Default to Server Components (no 'use client')
- Add 'use client' only for interactivity (useState, useEffect, event handlers)
- Keep EmulatorJS integration in client components

## WebSocket Server

- Custom server in `server.ts` wraps Next.js
- Socket.IO for reliable bi-directional communication
- WebRTC signaling through Socket.IO events

## EmulatorJS Integration

```typescript
// Client component for emulator
"use client";

declare global {
	interface Window {
		EJS_player: string;
		EJS_gameUrl: string;
		EJS_core: string;
		EJS_pathtodata: string;
	}
}

// Set globals before loading EmulatorJS script
window.EJS_player = "#game";
window.EJS_core = "nes";
```

## ROM Management

- ROMs live in `{GAMES_DIR}/{System}/ROMs/` for local scanning
- Served at runtime via `/api/roms/{path}` (R2 first when configured, else local disk)
- Supported systems: `nes`, `snes`, `gb`, `gba`, `n64`
- Library metadata in `{DATA_DIR}/metadata.json`; seed from R2 with `LIBRARY_SOURCE=r2`
- Upload tooling: `scripts/upload-to-r2.js`, `scripts/upload-manifest.js`
