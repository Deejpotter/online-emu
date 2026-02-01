/**
 * Streaming Session API
 *
 * POST /api/stream - Create a new streaming session for a game
 * GET /api/stream?id=xxx - Get session info
 *
 * This endpoint is called by the mobile app when a user wants to play a game.
 * It creates a session ID that both the streaming page and the phone use
 * to connect via WebRTC.
 *
 * For external emulators (PS2/GameCube):
 * - Launches the desktop emulator
 * - Returns a /capture URL instead of /stream URL
 * - Creates a virtual gamepad for controller input
 */

import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/streaming-manager";
import { getGame } from "@/lib/game-library";

/**
 * POST /api/stream
 * Create a new streaming session for a game.
 *
 * Request body: { gameId: string }
 * Response: { sessionId: string, streamUrl: string, isExternal: boolean }
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { gameId } = body;

		if (!gameId) {
			return NextResponse.json(
				{ success: false, error: "gameId is required" },
				{ status: 400 }
			);
		}

		// Get game info
		const game = await getGame(gameId);

		if (!game) {
			return NextResponse.json(
				{ success: false, error: "Game not found" },
				{ status: 404 }
			);
		}

		// Create streaming session (async now due to emulator launching)
		const result = await createSession(game);

		if (result.error) {
			return NextResponse.json(
				{ success: false, error: result.error },
				{ status: 500 }
			);
		}

		const { sessionId, isExternal } = result;

		// Build URL for the streaming page (to be opened on the server)
		// External sessions use /capture, internal sessions use /stream
		const pageRoute = isExternal ? "capture" : "stream";
		const streamUrl = `/${pageRoute}?session=${encodeURIComponent(
			sessionId
		)}&game=${encodeURIComponent(gameId)}`;

		return NextResponse.json({
			success: true,
			data: {
				sessionId,
				streamUrl,
				isExternal,
				game: {
					id: game.id,
					title: game.title,
					system: game.system,
				},
			},
		});
	} catch (error) {
		console.error("[API] Error creating stream session:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to create streaming session" },
			{ status: 500 }
		);
	}
}

/**
 * GET /api/stream?id=xxx
 * Get information about a streaming session.
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const sessionId = searchParams.get("id");

	if (!sessionId) {
		return NextResponse.json(
			{ success: false, error: "Session ID is required" },
			{ status: 400 }
		);
	}

	const session = getSession(sessionId);

	if (!session) {
		return NextResponse.json(
			{ success: false, error: "Session not found" },
			{ status: 404 }
		);
	}

	return NextResponse.json({
		success: true,
		data: {
			sessionId: session.id,
			game: {
				id: session.game.id,
				title: session.game.title,
				system: session.game.system,
			},
			state: session.state,
			viewerCount: session.viewerSocketIds.size,
			hasStreamer: session.streamerSocketId !== null,
		},
	});
}
