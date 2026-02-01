/**
 * Games API Route
 *
 * GET /api/games - List all games or filter by system
 * POST /api/games/scan - Scan for new ROMs
 */

import { NextRequest, NextResponse } from "next/server";
import {
	getAllGames,
	getGamesBySystem,
	scanForNewRoms,
	getSupportedSystems,
} from "@/lib/game-library";
import type { EmulatorSystem, ApiResponse, ApiError } from "@/types";

/**
 * GET /api/games
 *
 * Query params:
 *   system - Filter by emulator system (e.g., 'nes', 'snes')
 */
export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const system = searchParams.get("system") as EmulatorSystem | null;

		// Validate system if provided
		if (system) {
			const validSystems = getSupportedSystems();
			if (!validSystems.includes(system)) {
				const errorResponse: ApiError = {
					success: false,
					error: `Invalid system: ${system}. Valid systems: ${validSystems.join(
						", "
					)}`,
				};
				return NextResponse.json(errorResponse, { status: 400 });
			}
		}

		// Fetch games
		const games = system ? await getGamesBySystem(system) : await getAllGames();

		const response: ApiResponse<{ games: typeof games; total: number }> = {
			success: true,
			data: {
				games,
				total: games.length,
			},
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("[API] Error fetching games:", error);

		const errorResponse: ApiError = {
			success: false,
			error: "Failed to fetch games",
			details: error instanceof Error ? error.message : String(error),
		};

		return NextResponse.json(errorResponse, { status: 500 });
	}
}

/**
 * POST /api/games
 *
 * Actions:
 *   { action: 'scan' } - Scan for new ROMs
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { action } = body;

		if (action === "scan") {
			// Scan for new ROMs
			const result = await scanForNewRoms();

			const response: ApiResponse<typeof result> = {
				success: true,
				data: result,
			};

			return NextResponse.json(response);
		}

		// Invalid action
		const errorResponse: ApiError = {
			success: false,
			error: `Invalid action: ${action}. Valid actions: scan`,
		};

		return NextResponse.json(errorResponse, { status: 400 });
	} catch (error) {
		console.error("[API] Error in POST /api/games:", error);

		const errorResponse: ApiError = {
			success: false,
			error: "Failed to process request",
			details: error instanceof Error ? error.message : String(error),
		};

		return NextResponse.json(errorResponse, { status: 500 });
	}
}
