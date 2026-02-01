/**
 * Game Saves API Route
 *
 * Handles server-side save file storage for EmulatorJS games.
 * Saves are stored as .state files in profile-specific directories.
 *
 * GET  /api/saves/[gameId] - Load save state from server
 * POST /api/saves/[gameId] - Save state to server
 * DELETE /api/saves/[gameId] - Delete save state from server
 *
 * URL Parameters:
 *   gameId - The game name (same as EJS_gameName, URL-decoded)
 *
 * Query Parameters:
 *   system - The emulator system (e.g., 'n64', 'psx') - required for locating save dir
 *   slot   - Save slot number (default: 0 for quick save)
 *
 * Authentication:
 *   Requires 'profileId' cookie to identify the user.
 *   Returns 401 if no profile is selected.
 *
 * Save files are stored at:
 *   {gamesDir}/{system}/saves/{profileId}/{gameId}.state{slot}
 *
 * Migration: If no save exists in profile dir, checks legacy path:
 *   {gamesDir}/{system}/saves/{gameId}.state{slot}
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
 * GET /api/saves/[gameId]
 *
 * Load a save state file from the server.
 * Returns the raw binary state data.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ gameId: string }> }
) {
	try {
		const { gameId } = await params;
		const searchParams = request.nextUrl.searchParams;
		const system = searchParams.get("system");
		const slot = searchParams.get("slot") || "0";

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

		// Build save file path: {gamesDir}/{system}/saves/{profileId}/{gameId}.state{slot}
		const gamesDir = getGamesDirectory();
		const profileSavesDir = path.join(gamesDir, system, "saves", profileId);
		const legacySavesDir = path.join(gamesDir, system, "saves");
		const saveFileName =
			slot === "0" ? `${decodedGameId}.state` : `${decodedGameId}.state${slot}`;
		const profileSavePath = path.join(profileSavesDir, saveFileName);
		const legacySavePath = path.join(legacySavesDir, saveFileName);

		// Security check: ensure path stays within games directory
		const resolvedPath = path.resolve(profileSavePath);
		const resolvedGamesDir = path.resolve(gamesDir);
		if (!resolvedPath.startsWith(resolvedGamesDir)) {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}

		// Check if save file exists in profile directory
		let savePath = profileSavePath;
		let isLegacy = false;
		try {
			await fs.access(profileSavePath);
		} catch {
			// Try legacy path (for migration)
			try {
				await fs.access(legacySavePath);
				savePath = legacySavePath;
				isLegacy = true;
				console.log(
					`[API] Found legacy save for "${decodedGameId}" - consider migrating to profile dir`
				);
			} catch {
				// No save file exists - return 404 (this is normal for new games)
				return NextResponse.json(
					{
						success: false,
						error: "Save file not found",
						path: profileSavePath.replace(gamesDir, "{gamesDir}"),
					},
					{ status: 404 }
				);
			}
		}

		// Read and return the save file
		const saveData = await fs.readFile(savePath);
		console.log(
			`[API] Loaded save for "${decodedGameId}" profile=${profileId} (${
				saveData.length
			} bytes)${isLegacy ? " [LEGACY]" : ""}`
		);

		return new NextResponse(saveData, {
			status: 200,
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Length": saveData.length.toString(),
				"X-Save-Slot": slot,
				"X-Game-Id": decodedGameId,
				"X-Profile-Id": profileId,
				"X-Legacy-Save": isLegacy ? "true" : "false",
			},
		});
	} catch (error) {
		console.error("[API] Error loading save:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to load save",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

/**
 * POST /api/saves/[gameId]
 *
 * Save a state file to the server.
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
		const slot = searchParams.get("slot") || "0";

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

		// Build save file path (always use profile directory for new saves)
		const gamesDir = getGamesDirectory();
		const savesDir = path.join(gamesDir, system, "saves", profileId);
		const saveFileName =
			slot === "0" ? `${decodedGameId}.state` : `${decodedGameId}.state${slot}`;
		const savePath = path.join(savesDir, saveFileName);

		// Security check
		const resolvedPath = path.resolve(savePath);
		const resolvedGamesDir = path.resolve(gamesDir);
		if (!resolvedPath.startsWith(resolvedGamesDir)) {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}

		// Get the save data from request body
		const saveData = await request.arrayBuffer();
		if (!saveData || saveData.byteLength === 0) {
			return NextResponse.json(
				{ success: false, error: "No save data provided" },
				{ status: 400 }
			);
		}

		// Ensure saves directory exists (includes profile subdirectory)
		await fs.mkdir(savesDir, { recursive: true });

		// Write the save file
		await fs.writeFile(savePath, Buffer.from(saveData));
		console.log(
			`[API] Saved state for "${decodedGameId}" profile=${profileId} (${saveData.byteLength} bytes)`
		);

		return NextResponse.json({
			success: true,
			data: {
				gameId: decodedGameId,
				profileId,
				slot,
				size: saveData.byteLength,
				savedAt: new Date().toISOString(),
			},
		});
	} catch (error) {
		console.error("[API] Error saving state:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to save state",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/saves/[gameId]
 *
 * Delete a save file from the server.
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
		const slot = searchParams.get("slot") || "0";

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

		if (!system) {
			return NextResponse.json(
				{ success: false, error: "Missing required parameter: system" },
				{ status: 400 }
			);
		}

		const decodedGameId = decodeURIComponent(gameId);
		const gamesDir = getGamesDirectory();
		const savesDir = path.join(gamesDir, system, "saves", profileId);
		const saveFileName =
			slot === "0" ? `${decodedGameId}.state` : `${decodedGameId}.state${slot}`;
		const savePath = path.join(savesDir, saveFileName);

		// Security check
		const resolvedPath = path.resolve(savePath);
		const resolvedGamesDir = path.resolve(gamesDir);
		if (!resolvedPath.startsWith(resolvedGamesDir)) {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}

		// Delete the file
		await fs.unlink(savePath);
		console.log(
			`[API] Deleted save for "${decodedGameId}" profile=${profileId} slot=${slot}`
		);

		return NextResponse.json({
			success: true,
			data: { gameId: decodedGameId, profileId, slot, deleted: true },
		});
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return NextResponse.json(
				{ success: false, error: "Save file not found" },
				{ status: 404 }
			);
		}
		console.error("[API] Error deleting save:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to delete save",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
