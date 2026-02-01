---
applyTo: "server/**/*.ts,server/**/*.tsx"
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

- Store ROMs in `public/roms/{system}/`
- Supported systems: nes, snes, gba, gb, n64, segaMD, psx
- Metadata in `public/roms/metadata.json`
