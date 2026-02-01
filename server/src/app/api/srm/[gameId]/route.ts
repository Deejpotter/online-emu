/**
 * SRM (In-Game Saves) API Route
 *
 * Handles server-side storage for SRM files (in-game battery/memory card saves).
 * These are different from save states - they persist the game's internal save system.
 *
 * GET  /api/srm/[gameId] - Load SRM file from server
 * POST /api/srm/[gameId] - Save SRM file to server
 * DELETE /api/srm/[gameId] - Delete SRM file from server
 *
 * URL Parameters:
 *   gameId - The game name (same as EJS_gameName, URL-decoded)
 *
 * Query Parameters:
 *   system - The emulator system (e.g., 'n64', 'psx') - required for locating save dir
 *
 * Authentication:
 *   Requires 'profileId' cookie to identify the user.
 *   Returns 401 if no profile is selected.
 *
 * SRM files are stored at:
 *   {gamesDir}/{system}/saves/{profileId}/{gameId}.srm
 *
 * Migration: If no SRM exists in profile dir, checks legacy path:
 *   {gamesDir}/{system}/saves/{gameId}.srm
 *   Legacy saves are read but new saves always go to profile dir.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getGamesDirectory } from "@/lib/game-library";

/**
 * Get profile ID from request cookies.
 * Returns null if not found.
 */
function getProfileId(request: NextRequest): string | null {
	return request.cookies.get("profileId")?.value || null;
}

/**
 * GET /api/srm/[gameId]
 *
 * Load an SRM (in-game save) file from the server.
 * Returns the raw binary SRM data.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ gameId: string }> }
) {
	try {
		const { gameId } = await params;
		const searchParams = request.nextUrl.searchParams;
		const system = searchParams.get("system");

		// Get profile ID from cookie
		const profileId = getProfileId(request);
		if (!profileId) {
			return NextResponse.json(
				{
					success: false,
					error: "No profile selected. Please select a profile first.",
				},
				{ status: 401 }
			);
		}

		// Validate required params
		if (!system) {
			return NextResponse.json(
				{ success: false, error: "Missing required parameter: system" },
				{ status: 400 }
			);
		}

		// Decode the game ID (it may contain URL-encoded characters)
		const decodedGameId = decodeURIComponent(gameId);

		// Build SRM file paths
		const gamesDir = getGamesDirectory();
		const profileSavesDir = path.join(gamesDir, system, "saves", profileId);
		const legacySavesDir = path.join(gamesDir, system, "saves");
		const srmFileName = `${decodedGameId}.srm`;
		const profileSrmPath = path.join(profileSavesDir, srmFileName);
		const legacySrmPath = path.join(legacySavesDir, srmFileName);

		// Security check: ensure path stays within games directory
		const resolvedPath = path.resolve(profileSrmPath);
		const resolvedGamesDir = path.resolve(gamesDir);
		if (!resolvedPath.startsWith(resolvedGamesDir)) {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}

		// Check if SRM file exists in profile directory
		let srmPath = profileSrmPath;
		let isLegacy = false;
		try {
			await fs.access(profileSrmPath);
		} catch {
			// Try legacy path (for migration)
			try {
				await fs.access(legacySrmPath);
				srmPath = legacySrmPath;
				isLegacy = true;
				console.log(
					`[API] Found legacy SRM for "${decodedGameId}" - consider migrating to profile dir`
				);
			} catch {
				// No SRM file exists - return 404 (this is normal for new games)
				return NextResponse.json(
					{
						success: false,
						error: "SRM file not found",
						path: profileSrmPath.replace(gamesDir, "{gamesDir}"),
					},
					{ status: 404 }
				);
			}
		}

		// Read and return the SRM file
		const srmData = await fs.readFile(srmPath);
		console.log(
			`[API] Loaded SRM for "${decodedGameId}" profile=${profileId} (${
				srmData.length
			} bytes)${isLegacy ? " [LEGACY]" : ""}`
		);

		return new NextResponse(srmData, {
			status: 200,
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Length": srmData.length.toString(),
				"X-Game-Id": decodedGameId,
				"X-Save-Type": "srm",
				"X-Profile-Id": profileId,
				"X-Legacy-Save": isLegacy ? "true" : "false",
			},
		});
	} catch (error) {
		console.error("[API] Error loading SRM:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to load SRM",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

/**
 * POST /api/srm/[gameId]
 *
 * Save an SRM (in-game save) file to the server.
 * Expects raw binary data in the request body.
 * Always saves to profile-specific directory.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ gameId: string }> }
) {
	try {
		const { gameId } = await params;
		const searchParams = request.nextUrl.searchParams;
		const system = searchParams.get("system");

		// Get profile ID from cookie
		const profileId = getProfileId(request);
		if (!profileId) {
			return NextResponse.json(
				{
					success: false,
					error: "No profile selected. Please select a profile first.",
				},
				{ status: 401 }
			);
		}

		// Validate required params
		if (!system) {
			return NextResponse.json(
				{ success: false, error: "Missing required parameter: system" },
				{ status: 400 }
			);
		}

		// Decode the game ID
		const decodedGameId = decodeURIComponent(gameId);

		// Build SRM file path (always use profile directory for new saves)
		const gamesDir = getGamesDirectory();
		const savesDir = path.join(gamesDir, system, "saves", profileId);
		const srmFileName = `${decodedGameId}.srm`;
		const srmPath = path.join(savesDir, srmFileName);

		// Security check
		const resolvedPath = path.resolve(srmPath);
		const resolvedGamesDir = path.resolve(gamesDir);
		if (!resolvedPath.startsWith(resolvedGamesDir)) {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}

		// Get the binary data from request body
		const arrayBuffer = await request.arrayBuffer();
		const srmData = Buffer.from(arrayBuffer);

		if (srmData.length === 0) {
			return NextResponse.json(
				{ success: false, error: "Empty SRM data" },
				{ status: 400 }
			);
		}

		// Ensure saves directory exists (includes profile subdirectory)
		await fs.mkdir(savesDir, { recursive: true });

		// Write the SRM file
		await fs.writeFile(srmPath, srmData);
		console.log(
			`[API] Saved SRM for "${decodedGameId}" profile=${profileId} (${srmData.length} bytes)`
		);

		return NextResponse.json({
			success: true,
			data: {
				gameId: decodedGameId,
				profileId,
				system,
				size: srmData.length,
				path: srmPath.replace(gamesDir, "{gamesDir}"),
			},
		});
	} catch (error) {
		console.error("[API] Error saving SRM:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to save SRM",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/srm/[gameId]
 *
 * Delete an SRM file from the server.
 * Only deletes from profile-specific directory (not legacy saves).
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ gameId: string }> }
) {
	try {
		const { gameId } = await params;
		const searchParams = request.nextUrl.searchParams;
		const system = searchParams.get("system");

		// Get profile ID from cookie
		const profileId = getProfileId(request);
		if (!profileId) {
			return NextResponse.json(
				{
					success: false,
					error: "No profile selected. Please select a profile first.",
				},
				{ status: 401 }
			);
		}

		// Validate required params
		if (!system) {
			return NextResponse.json(
				{ success: false, error: "Missing required parameter: system" },
				{ status: 400 }
			);
		}

		// Decode the game ID
		const decodedGameId = decodeURIComponent(gameId);

		// Build SRM file path (profile directory only)
		const gamesDir = getGamesDirectory();
		const savesDir = path.join(gamesDir, system, "saves", profileId);
		const srmFileName = `${decodedGameId}.srm`;
		const srmPath = path.join(savesDir, srmFileName);

		// Security check
		const resolvedPath = path.resolve(srmPath);
		const resolvedGamesDir = path.resolve(gamesDir);
		if (!resolvedPath.startsWith(resolvedGamesDir)) {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}

		// Check if file exists
		try {
			await fs.access(srmPath);
		} catch {
			return NextResponse.json(
				{ success: false, error: "SRM file not found" },
				{ status: 404 }
			);
		}

		// Delete the file
		await fs.unlink(srmPath);
		console.log(
			`[API] Deleted SRM for "${decodedGameId}" profile=${profileId}`
		);

		return NextResponse.json({
			success: true,
			data: {
				gameId: decodedGameId,
				profileId,
				system,
				deleted: true,
			},
		});
	} catch (error) {
		console.error("[API] Error deleting SRM:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to delete SRM",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
