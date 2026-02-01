/**
 * External Emulator Launch API
 *
 * POST /api/launch
 *   Launch a game in an external emulator (PCSX2, Dolphin)
 *
 * DELETE /api/launch
 *   Stop a running emulator
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
	launchEmulator,
	stopEmulator,
	getRunningEmulator,
} from "@/lib/emulator-launcher";
import { getGameById } from "@/lib/game-library";
import { isExternalSystem } from "@/types";

/**
 * POST /api/launch
 * Launch a game in an external emulator.
 *
 * Body: { gameId: string }
 */
export async function POST(request: NextRequest) {
	try {
		// Get profile ID from cookie (used as session ID)
		const cookieStore = await cookies();
		const profileId = cookieStore.get("profileId")?.value;

		if (!profileId) {
			return NextResponse.json(
				{ error: "No profile selected" },
				{ status: 401 }
			);
		}

		const body = await request.json();
		const { gameId } = body;

		if (!gameId) {
			return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
		}

		// Get the game
		const game = await getGameById(gameId);
		if (!game) {
			return NextResponse.json({ error: "Game not found" }, { status: 404 });
		}

		// Verify this is an external system game
		if (!isExternalSystem(game.system)) {
			return NextResponse.json(
				{ error: `${game.system} games don't need external emulators` },
				{ status: 400 }
			);
		}

		// Launch the emulator
		const result = await launchEmulator(profileId, game);

		if (!result.success) {
			return NextResponse.json({ error: result.error }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			message: `Launched ${game.title} in external emulator`,
		});
	} catch (error) {
		console.error("[API] Error launching emulator:", error);
		return NextResponse.json(
			{ error: "Failed to launch emulator" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/launch
 * Stop the running emulator for current profile.
 */
export async function DELETE() {
	try {
		// Get profile ID from cookie
		const cookieStore = await cookies();
		const profileId = cookieStore.get("profileId")?.value;

		if (!profileId) {
			return NextResponse.json(
				{ error: "No profile selected" },
				{ status: 401 }
			);
		}

		const stopped = await stopEmulator(profileId);

		return NextResponse.json({
			success: true,
			stopped,
		});
	} catch (error) {
		console.error("[API] Error stopping emulator:", error);
		return NextResponse.json(
			{ error: "Failed to stop emulator" },
			{ status: 500 }
		);
	}
}

/**
 * GET /api/launch
 * Get status of running emulator for current profile.
 */
export async function GET() {
	try {
		// Get profile ID from cookie
		const cookieStore = await cookies();
		const profileId = cookieStore.get("profileId")?.value;

		if (!profileId) {
			return NextResponse.json(
				{ error: "No profile selected" },
				{ status: 401 }
			);
		}

		const emulator = getRunningEmulator(profileId);

		if (!emulator) {
			return NextResponse.json({
				running: false,
			});
		}

		return NextResponse.json({
			running: true,
			system: emulator.system,
			gameId: emulator.gameId,
			startedAt: emulator.startedAt,
		});
	} catch (error) {
		console.error("[API] Error getting emulator status:", error);
		return NextResponse.json(
			{ error: "Failed to get emulator status" },
			{ status: 500 }
		);
	}
}
