/**
 * Emulator Launcher Service
 *
 * Handles launching and managing external emulator processes (PCSX2, Dolphin).
 * Tracks running emulator processes and ensures they are properly cleaned up
 * when streaming sessions end.
 */

import { spawn, ChildProcess } from "child_process";
import path from "path";
import {
	getEmulatorConfig,
	buildLaunchArgs,
	validateEmulator,
} from "./emulator-config";
import type { Game, EmulatorSystem } from "@/types";
import { isExternalSystem } from "@/types";

// Track running emulator processes by session ID
const runningEmulators = new Map<
	string,
	{
		process: ChildProcess;
		system: EmulatorSystem;
		gameId: string;
		startedAt: Date;
	}
>();

// External games directory - same as game-library.ts
const GAMES_DIR = process.env.GAMES_DIR || "H:\\Games";

/**
 * Launch an external emulator for a game.
 * Returns true if the emulator was launched successfully.
 */
export async function launchEmulator(
	sessionId: string,
	game: Game
): Promise<{ success: boolean; error?: string }> {
	// Verify this is an external system
	if (!isExternalSystem(game.system)) {
		return {
			success: false,
			error: `${game.system} is not an external system`,
		};
	}

	// Only PS2 and GameCube are supported currently
	if (game.system !== "ps2" && game.system !== "gamecube") {
		return {
			success: false,
			error: `Unsupported external system: ${game.system}`,
		};
	}

	// Check if emulator is configured
	const validation = await validateEmulator(game.system);
	if (!validation.valid) {
		return {
			success: false,
			error: validation.error,
		};
	}

	// Check if there's already an emulator running for this session
	if (runningEmulators.has(sessionId)) {
		// Kill existing emulator first
		await stopEmulator(sessionId);
	}

	try {
		// Get emulator config
		const config = await getEmulatorConfig(game.system);

		// Build the full ROM path
		const romPath = path.join(GAMES_DIR, game.romPath);

		// Build launch arguments
		const args = buildLaunchArgs(config, romPath);

		console.log(
			`[EmulatorLauncher] Launching ${config.name}:`,
			config.executablePath
		);
		console.log(`[EmulatorLauncher] Arguments:`, args);

		// Spawn the emulator process
		const emulatorProcess = spawn(config.executablePath, args, {
			detached: false, // Keep as child process so we can kill it
			stdio: "ignore", // Don't capture stdio
			windowsHide: false, // Show the window
		});

		// Handle process exit
		emulatorProcess.on("exit", (code, signal) => {
			console.log(
				`[EmulatorLauncher] ${config.name} exited with code ${code}, signal ${signal}`
			);
			runningEmulators.delete(sessionId);
		});

		emulatorProcess.on("error", (err) => {
			console.error(`[EmulatorLauncher] ${config.name} error:`, err);
			runningEmulators.delete(sessionId);
		});

		// Track the running process
		runningEmulators.set(sessionId, {
			process: emulatorProcess,
			system: game.system,
			gameId: game.id,
			startedAt: new Date(),
		});

		console.log(
			`[EmulatorLauncher] ${config.name} launched for session ${sessionId}, PID: ${emulatorProcess.pid}`
		);

		return { success: true };
	} catch (error) {
		console.error("[EmulatorLauncher] Failed to launch emulator:", error);
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to launch emulator",
		};
	}
}

/**
 * Stop an emulator for a session.
 */
export async function stopEmulator(sessionId: string): Promise<void> {
	const emulator = runningEmulators.get(sessionId);
	if (!emulator) {
		return;
	}

	console.log(`[EmulatorLauncher] Stopping emulator for session ${sessionId}`);

	try {
		// Kill the process
		if (!emulator.process.killed) {
			// On Windows, SIGTERM doesn't work well, use kill
			if (process.platform === "win32") {
				// Use taskkill for more reliable killing on Windows
				spawn("taskkill", ["/pid", String(emulator.process.pid), "/f", "/t"], {
					stdio: "ignore",
				});
			} else {
				emulator.process.kill("SIGTERM");
			}
		}
	} catch (error) {
		console.error("[EmulatorLauncher] Error stopping emulator:", error);
	}

	runningEmulators.delete(sessionId);
}

/**
 * Get info about a running emulator.
 */
export function getEmulatorInfo(sessionId: string): {
	running: boolean;
	system?: EmulatorSystem;
	gameId?: string;
	startedAt?: Date;
	pid?: number;
} {
	const emulator = runningEmulators.get(sessionId);
	if (!emulator) {
		return { running: false };
	}

	return {
		running: true,
		system: emulator.system,
		gameId: emulator.gameId,
		startedAt: emulator.startedAt,
		pid: emulator.process.pid,
	};
}

/**
 * Get a running emulator for a session (alias for getEmulatorInfo with simpler return type).
 */
export function getRunningEmulator(sessionId: string): {
	system: EmulatorSystem;
	gameId: string;
	startedAt: Date;
} | null {
	const emulator = runningEmulators.get(sessionId);
	if (!emulator) {
		return null;
	}

	return {
		system: emulator.system,
		gameId: emulator.gameId,
		startedAt: emulator.startedAt,
	};
}

/**
 * Check if an emulator is running for a session.
 */
export function isEmulatorRunning(sessionId: string): boolean {
	return runningEmulators.has(sessionId);
}

/**
 * Get all running emulators.
 */
export function getAllRunningEmulators(): Array<{
	sessionId: string;
	system: EmulatorSystem;
	gameId: string;
	startedAt: Date;
	pid: number | undefined;
}> {
	return Array.from(runningEmulators.entries()).map(
		([sessionId, emulator]) => ({
			sessionId,
			system: emulator.system,
			gameId: emulator.gameId,
			startedAt: emulator.startedAt,
			pid: emulator.process.pid,
		})
	);
}

/**
 * Stop all running emulators (called on server shutdown).
 */
export function stopAllEmulators(): void {
	console.log(
		`[EmulatorLauncher] Stopping ${runningEmulators.size} running emulators`
	);

	for (const sessionId of runningEmulators.keys()) {
		stopEmulator(sessionId);
	}
}
