---
applyTo: "server/app/api/**/*.ts"
---

# API Development Instructions

## Route Handler Patterns

### Standard CRUD Operations

```typescript
// app/api/games/route.ts
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const system = searchParams.get("system");

	// Filter games by system if provided
	const games = await getGames(system);
	return Response.json({ games });
}

export async function POST(request: NextRequest) {
	const body = await request.json();
	// Validate with Zod
	const result = gameSchema.safeParse(body);
	if (!result.success) {
		return Response.json({ error: result.error }, { status: 400 });
	}

	const game = await createGame(result.data);
	return Response.json({ game }, { status: 201 });
}
```

### Dynamic Routes

```typescript
// app/api/games/[id]/route.ts
export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	const game = await getGame(params.id);
	if (!game) {
		return Response.json({ error: "Not found" }, { status: 404 });
	}
	return Response.json({ game });
}
```

## Response Conventions

- Success: `{ data: ... }` or `{ games: [...] }`
- Error: `{ error: string, details?: any }`
- Status codes: 200 (OK), 201 (Created), 400 (Bad Request), 404 (Not Found), 500 (Server Error)

## WebSocket Events API

Events are handled in `server.ts`, not in API routes.

```typescript
// Input event payload
interface InputEvent {
	button:
		| "A"
		| "B"
		| "X"
		| "Y"
		| "UP"
		| "DOWN"
		| "LEFT"
		| "RIGHT"
		| "START"
		| "SELECT"
		| "L"
		| "R";
	pressed: boolean;
	timestamp: number;
	playerId?: number;
}
```
