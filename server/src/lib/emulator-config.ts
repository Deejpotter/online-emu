/**
 * External Emulator Configuration
 *
 * Manages configuration for external desktop emulators (PCSX2, Dolphin, etc.)
 * that are used to run PS2 and GameCube games via screen capture streaming.
 */

import fs from "fs/promises";
import path from "path";
import type { ExternalEmulatorConfig } from "@/types";
import { EXTERNAL_SYSTEMS } from "@/types";

// Configuration is stored locally in the server's data directory
const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "emulator-config.json");

/**
 * Default emulator configurations with common installation paths.
 *
 * PCSX2-Qt Command Line Reference (from pcsx2.net/docs/advanced/cli/):
 *   -fullscreen: Enters fullscreen mode immediately after starting
 *   -batch: Exits after shutting down (clean exit when game closes)
 *   -bigpicture: Forces Big Picture mode (controller-friendly UI)
 *   --: Signals filename follows (handles spaces/dashes in paths)
 */
const DEFAULT_CONFIGS: Record<
	"ps2" | "gamecube",
	Omit<ExternalEmulatorConfig, "isConfigured">
> = {
	ps2: {
		system: "ps2",
		name: "PCSX2",
		// Common installation paths - user can override
		executablePath: "",
		// PCSX2-Qt args: -fullscreen -batch -- {ROM}
		// The -- separates options from filename (handles spaces in paths)
		launchArgs: ["-fullscreen", "-batch", "--", "{ROM}"],
	},
	gamecube: {
		system: "gamecube",
		name: "Dolphin",
		executablePath: "",
		launchArgs: [
			"-e",
			"{ROM}",
			"--batch",
			"--config",
			"Dolphin.Display.Fullscreen=True",
		],
	},
};

/**
 * Common installation paths to check for emulators on Windows.
 */
const COMMON_PATHS: Record<"ps2" | "gamecube", string[]> = {
	ps2: [
		"C:\\Program Files\\PCSX2\\pcsx2-qt.exe",
		"C:\\Program Files\\PCSX2\\pcsx2.exe",
		"C:\\Program Files (x86)\\PCSX2\\pcsx2-qt.exe",
		"C:\\Program Files (x86)\\PCSX2\\pcsx2.exe",
		// Portable installations
		"D:\\Programs\\PCSX2\\pcsx2-qt.exe",
		"D:\\Games\\PCSX2\\pcsx2-qt.exe",
	],
	gamecube: [
		"C:\\Program Files\\Dolphin\\Dolphin.exe",
		"C:\\Program Files (x86)\\Dolphin\\Dolphin.exe",
		// Dolphin dev versions
		"C:\\Program Files\\Dolphin-x64\\Dolphin.exe",
		"C:\\Program Files (x86)\\Dolphin-x64\\Dolphin.exe",
		// Portable installations
		"D:\\Programs\\Dolphin\\Dolphin.exe",
		"D:\\Games\\Dolphin\\Dolphin.exe",
	],
};

/**
 * Full configuration storage format.
 */
interface EmulatorConfigFile {
	emulators: Record<string, ExternalEmulatorConfig>;
	lastUpdated: string;
}

/**
 * Check if a file exists at the given path.
 */
async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Try to auto-detect an emulator by checking common installation paths.
 */
async function autoDetectEmulator(
	system: "ps2" | "gamecube"
): Promise<string | null> {
	const paths = COMMON_PATHS[system];
	for (const execPath of paths) {
		if (await fileExists(execPath)) {
			console.log(
				`[EmulatorConfig] Auto-detected ${system} emulator at: ${execPath}`
			);
			return execPath;
		}
	}
	return null;
}

/**
 * Load emulator configuration from disk.
 */
export async function loadEmulatorConfig(): Promise<EmulatorConfigFile> {
	try {
		const data = await fs.readFile(CONFIG_PATH, "utf-8");
		return JSON.parse(data) as EmulatorConfigFile;
	} catch {
		// Return default config if file doesn't exist
		return {
			emulators: {},
			lastUpdated: new Date().toISOString(),
		};
	}
}

/**
 * Save emulator configuration to disk.
 */
export async function saveEmulatorConfig(
	config: EmulatorConfigFile
): Promise<void> {
	// Ensure data directory exists
	await fs.mkdir(DATA_DIR, { recursive: true });
	config.lastUpdated = new Date().toISOString();
	await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Get configuration for a specific emulator.
 * If not configured, attempts auto-detection.
 */
export async function getEmulatorConfig(
	system: "ps2" | "gamecube"
): Promise<ExternalEmulatorConfig> {
	const config = await loadEmulatorConfig();

	// Check if already configured
	if (config.emulators[system]) {
		const emulator = config.emulators[system];
		// Verify the executable still exists
		emulator.isConfigured = await fileExists(emulator.executablePath);
		return emulator;
	}

	// Not configured, try auto-detection
	const detectedPath = await autoDetectEmulator(system);
	const defaultConfig = DEFAULT_CONFIGS[system];

	const emulatorConfig: ExternalEmulatorConfig = {
		...defaultConfig,
		executablePath: detectedPath || "",
		isConfigured: !!detectedPath,
	};

	// Save if we found something
	if (detectedPath) {
		config.emulators[system] = emulatorConfig;
		await saveEmulatorConfig(config);
	}

	return emulatorConfig;
}

/**
 * Get configuration for all external emulators.
 */
export async function getAllEmulatorConfigs(): Promise<
	Record<string, ExternalEmulatorConfig>
> {
	const result: Record<string, ExternalEmulatorConfig> = {};

	for (const system of EXTERNAL_SYSTEMS) {
		if (system === "ps2" || system === "gamecube") {
			result[system] = await getEmulatorConfig(system);
		}
	}

	return result;
}

/**
 * Update configuration for an emulator.
 */
export async function setEmulatorPath(
	system: "ps2" | "gamecube",
	executablePath: string
): Promise<ExternalEmulatorConfig> {
	const config = await loadEmulatorConfig();
	const defaultConfig = DEFAULT_CONFIGS[system];

	const isValid = await fileExists(executablePath);

	const emulatorConfig: ExternalEmulatorConfig = {
		...defaultConfig,
		executablePath,
		isConfigured: isValid,
	};

	config.emulators[system] = emulatorConfig;
	await saveEmulatorConfig(config);

	return emulatorConfig;
}

/**
 * Update launch arguments for an emulator.
 */
export async function setEmulatorArgs(
	system: "ps2" | "gamecube",
	launchArgs: string[]
): Promise<ExternalEmulatorConfig> {
	const config = await loadEmulatorConfig();
	const currentConfig = await getEmulatorConfig(system);

	const updatedConfig: ExternalEmulatorConfig = {
		...currentConfig,
		launchArgs,
	};

	config.emulators[system] = updatedConfig;
	await saveEmulatorConfig(config);

	return updatedConfig;
}

/**
 * Build the command line arguments for launching a game.
 * Replaces {ROM} placeholder with the actual ROM path.
 */
export function buildLaunchArgs(
	config: ExternalEmulatorConfig,
	romPath: string
): string[] {
	return config.launchArgs.map((arg) => arg.replace("{ROM}", romPath));
}

/**
 * Validate that an emulator is properly configured and ready to use.
 */
export async function validateEmulator(
	system: "ps2" | "gamecube"
): Promise<{ valid: boolean; error?: string }> {
	const config = await getEmulatorConfig(system);

	if (!config.executablePath) {
		return {
			valid: false,
			error: `${config.name} executable path is not configured`,
		};
	}

	if (!(await fileExists(config.executablePath))) {
		return {
			valid: false,
			error: `${config.name} executable not found at: ${config.executablePath}`,
		};
	}

	return { valid: true };
}
