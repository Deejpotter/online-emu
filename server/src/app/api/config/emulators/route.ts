/**
 * External Emulator Configuration API
 *
 * GET /api/config/emulators
 *   Returns configuration for all external emulators
 *
 * POST /api/config/emulators
 *   Update emulator configuration (path and/or args)
 *
 * GET /api/config/emulators/validate?system=ps2
 *   Validate that a specific emulator is properly configured
 */

import { NextRequest, NextResponse } from "next/server";
import {
	getAllEmulatorConfigs,
	setEmulatorPath,
	setEmulatorArgs,
	validateEmulator,
} from "@/lib/emulator-config";

/**
 * GET /api/config/emulators
 * Get configuration for all external emulators.
 */
export async function GET(request: NextRequest) {
	try {
		// Check if this is a validation request
		const { searchParams } = new URL(request.url);
		const validateSystem = searchParams.get("validate");

		if (validateSystem) {
			// Validate specific emulator
			if (validateSystem !== "ps2" && validateSystem !== "gamecube") {
				return NextResponse.json(
					{
						error: `Invalid system: ${validateSystem}. Must be 'ps2' or 'gamecube'.`,
					},
					{ status: 400 }
				);
			}

			const result = await validateEmulator(validateSystem);
			return NextResponse.json(result);
		}

		// Return all emulator configs
		const configs = await getAllEmulatorConfigs();
		return NextResponse.json({
			emulators: configs,
			externalSystems: ["ps2", "gamecube"],
		});
	} catch (error) {
		console.error("[API] Error getting emulator config:", error);
		return NextResponse.json(
			{ error: "Failed to get emulator configuration" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/config/emulators
 * Update emulator configuration.
 *
 * Body: {
 *   system: "ps2" | "gamecube",
 *   executablePath?: string,
 *   launchArgs?: string[]
 * }
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { system, executablePath, launchArgs } = body;

		// Validate system
		if (!system || (system !== "ps2" && system !== "gamecube")) {
			return NextResponse.json(
				{ error: "Invalid or missing 'system'. Must be 'ps2' or 'gamecube'." },
				{ status: 400 }
			);
		}

		// Update path if provided
		if (executablePath !== undefined) {
			await setEmulatorPath(system, executablePath);
		}

		// Update args if provided
		if (launchArgs !== undefined) {
			if (!Array.isArray(launchArgs)) {
				return NextResponse.json(
					{ error: "'launchArgs' must be an array of strings" },
					{ status: 400 }
				);
			}
			await setEmulatorArgs(system, launchArgs);
		}

		// Get final config to return
		const allConfigs = await getAllEmulatorConfigs();

		return NextResponse.json({
			success: true,
			config: allConfigs[system],
		});
	} catch (error) {
		console.error("[API] Error updating emulator config:", error);
		return NextResponse.json(
			{ error: "Failed to update emulator configuration" },
			{ status: 500 }
		);
	}
}
