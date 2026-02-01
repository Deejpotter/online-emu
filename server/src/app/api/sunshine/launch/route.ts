/**
 * Sunshine Launch Game API
 *
 * POST /api/sunshine/launch - Launch a game via Sunshine streaming
 *
 * This endpoint:
 * 1. Gets the game details from the library
 * 2. Gets the emulator configuration (PCSX2/Dolphin)
 * 3. Registers the game as a Sunshine app (if not already)
 * 4. Returns the moonlight-web-stream URL for the client to connect
 *
 * The actual streaming happens via moonlight-web-stream, not through this server.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
	registerEmulatorGame,
	findAppByName,
	getMoonlightWebUrl,
	isSunshineAvailable,
} from "@/lib/sunshine-service";
import { getEmulatorConfig } from "@/lib/emulator-config";
import { getGameById } from "@/lib/game-library";
import { isExternalSystem } from "@/types";

export interface LaunchRequest {
	/** Game ID to launch */
	gameId: string;
}

export interface LaunchResponse {
	success: boolean;
	/** URL to moonlight-web-stream for streaming */
	streamUrl?: string;
	/** Name of the app registered in Sunshine */
	appName?: string;
	/** Error message if launch failed */
	error?: string;
}

export async function POST(
	request: NextRequest
): Promise<NextResponse<LaunchResponse>> {
	try {
		// Parse request body
		const body = (await request.json()) as LaunchRequest;
		const { gameId } = body;

		if (!gameId) {
			return NextResponse.json(
				{ success: false, error: "gameId is required" },
				{ status: 400 }
			);
		}

		// Check if Sunshine is available
		const sunshineAvailable = await isSunshineAvailable();
		if (!sunshineAvailable) {
			return NextResponse.json(
				{
					success: false,
					error: "Sunshine is not configured or not running. Please configure Sunshine in Settings.",
				},
				{ status: 503 }
			);
		}

		// Get game details
		const game = await getGameById(gameId);
		if (!game) {
			return NextResponse.json(
				{ success: false, error: "Game not found" },
				{ status: 404 }
			);
		}

		// Verify this is a Sunshine-streamed game (PS2/GameCube)
		if (!isExternalSystem(game.system)) {
			return NextResponse.json(
				{
					success: false,
					error: `${game.system} games use EmulatorJS, not Sunshine streaming`,
				},
				{ status: 400 }
			);
		}

		// Get emulator configuration
		const emulatorSystem = game.system as "ps2" | "gamecube";
		const emulatorConfig = await getEmulatorConfig(emulatorSystem);

		if (!emulatorConfig.isConfigured) {
			return NextResponse.json(
				{
					success: false,
					error: `${emulatorConfig.name} emulator not configured. Please set the path in Settings.`,
				},
				{ status: 503 }
			);
		}

		// Build full ROM path
		const romPath = path.join(
			process.cwd(),
			"public",
			"roms",
			game.romPath
		);

		// Create app name for Sunshine (include system for uniqueness)
		const appName = `[${game.system.toUpperCase()}] ${game.title}`;

		// Check if app already exists in Sunshine
		const existingApp = await findAppByName(appName);

		if (!existingApp.success) {
			return NextResponse.json(
				{
					success: false,
					error: `Failed to check Sunshine apps: ${existingApp.error}`,
				},
				{ status: 500 }
			);
		}

		// Register the game if not already registered
		if (!existingApp.data) {
			console.log(
				`[Sunshine] Registering new app: ${appName}`
			);

			const registerResult = await registerEmulatorGame(
				appName,
				emulatorConfig.executablePath,
				romPath,
				emulatorConfig.launchArgs,
				game.coverArt
					? path.join(process.cwd(), "public", "roms", game.coverArt)
					: undefined
			);

			if (!registerResult.success) {
				return NextResponse.json(
					{
						success: false,
						error: `Failed to register game in Sunshine: ${registerResult.error}`,
					},
					{ status: 500 }
				);
			}

			console.log(
				`[Sunshine] App registered with index: ${registerResult.data?.index}`
			);
		} else {
			console.log(
				`[Sunshine] App already registered: ${appName}`
			);
		}

		// Get moonlight-web-stream URL
		const moonlightWebUrl = await getMoonlightWebUrl();

		return NextResponse.json({
			success: true,
			streamUrl: moonlightWebUrl,
			appName,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";
		console.error("[Sunshine] Launch error:", message);
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
