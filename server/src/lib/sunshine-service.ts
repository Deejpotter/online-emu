/**
 * Sunshine Streaming Server Service
 *
 * Provides integration with Sunshine (https://github.com/LizardByte/Sunshine),
 * a self-hosted game streaming server compatible with Moonlight clients.
 *
 * Used for streaming PS2 (PCSX2) and GameCube (Dolphin) games to browser
 * via moonlight-web-stream.
 *
 * Sunshine API Reference:
 * - GET /api/apps - List all registered applications
 * - POST /api/apps - Add/update an application
 * - POST /api/apps/close - Close currently running application
 * - DELETE /api/apps/{index} - Delete an application
 *
 * All API calls require Basic Authentication with Sunshine admin credentials.
 */

import fs from "fs/promises";
import path from "path";

// =============================================================================
// Types
// =============================================================================

/**
 * Sunshine connection configuration.
 */
export interface SunshineConfig {
	/** Sunshine Web UI/API URL (default: https://localhost:47990) */
	url: string;
	/** Sunshine admin username */
	username: string;
	/** Sunshine admin password */
	password: string;
	/** moonlight-web-stream URL for browser streaming (default: http://localhost:8080) */
	moonlightWebUrl: string;
	/** Whether Sunshine integration is enabled */
	enabled: boolean;
}

/**
 * Sunshine application configuration.
 * Maps to the JSON format expected by POST /api/apps.
 */
export interface SunshineApp {
	/** Display name in Moonlight client */
	name: string;
	/** Command to execute */
	cmd: string;
	/** Working directory (auto-detected from cmd if empty) */
	"working-dir"?: string;
	/** Application index (-1 for new, existing index for update) */
	index: number;
	/** Path to cover image (PNG) */
	"image-path"?: string;
	/** Log output path */
	output?: string;
	/** Exclude global preparation commands */
	"exclude-global-prep-cmd"?: boolean;
	/** Run with admin privileges (Windows) */
	elevated?: boolean;
	/** Treat quick exits as successful launches (for launchers) */
	"auto-detach"?: boolean;
	/** Wait for all child processes to exit */
	"wait-all"?: boolean;
	/** Seconds to wait for graceful termination */
	"exit-timeout"?: number;
	/** Preparation commands (do/undo pairs) */
	"prep-cmd"?: Array<{
		do: string;
		undo: string;
		elevated?: boolean;
	}>;
	/** Detached background commands */
	detached?: string[];
}

/**
 * Sunshine app as returned by GET /api/apps.
 */
export interface SunshineAppResponse {
	name: string;
	cmd: string;
	index: number;
	"image-path"?: string;
	// ... other fields
}

/**
 * Result of a Sunshine API operation.
 */
export interface SunshineResult<T = void> {
	success: boolean;
	data?: T;
	error?: string;
}

// =============================================================================
// Configuration Storage
// =============================================================================

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "sunshine-config.json");

/**
 * Default Sunshine configuration.
 */
const DEFAULT_CONFIG: SunshineConfig = {
	url: "https://localhost:47990",
	username: "sunshine",
	password: "",
	moonlightWebUrl: "http://localhost:8080",
	enabled: false,
};

/**
 * Load Sunshine configuration from disk.
 */
export async function loadSunshineConfig(): Promise<SunshineConfig> {
	try {
		const data = await fs.readFile(CONFIG_PATH, "utf-8");
		const config = JSON.parse(data) as Partial<SunshineConfig>;
		// Merge with defaults to ensure all fields exist
		return { ...DEFAULT_CONFIG, ...config };
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

/**
 * Save Sunshine configuration to disk.
 */
export async function saveSunshineConfig(
	config: SunshineConfig
): Promise<void> {
	await fs.mkdir(DATA_DIR, { recursive: true });
	await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Create Basic Auth header value.
 */
function createAuthHeader(username: string, password: string): string {
	const credentials = Buffer.from(`${username}:${password}`).toString(
		"base64"
	);
	return `Basic ${credentials}`;
}

/**
 * Make a request to the Sunshine API.
 *
 * Note: Sunshine uses a self-signed certificate by default, so we need to
 * disable certificate verification. In production, users should configure
 * proper certificates.
 */
async function sunshineRequest<T>(
	config: SunshineConfig,
	method: string,
	endpoint: string,
	body?: unknown
): Promise<SunshineResult<T>> {
	if (!config.enabled) {
		return { success: false, error: "Sunshine integration is disabled" };
	}

	if (!config.password) {
		return {
			success: false,
			error: "Sunshine password not configured",
		};
	}

	const url = `${config.url}${endpoint}`;

	try {
		// Use node's fetch with custom agent for self-signed certs
		const response = await fetch(url, {
			method,
			headers: {
				"Content-Type": "application/json",
				Authorization: createAuthHeader(config.username, config.password),
			},
			body: body ? JSON.stringify(body) : undefined,
			// @ts-expect-error - Node.js fetch supports this for self-signed certs
			rejectUnauthorized: false,
		});

		if (!response.ok) {
			const errorText = await response.text();
			return {
				success: false,
				error: `Sunshine API error ${response.status}: ${errorText}`,
			};
		}

		// Some endpoints return empty response
		const text = await response.text();
		if (!text) {
			return { success: true };
		}

		try {
			const data = JSON.parse(text) as T;
			return { success: true, data };
		} catch {
			// Response wasn't JSON, but request succeeded
			return { success: true };
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";

		// Provide helpful error messages for common issues
		if (message.includes("ECONNREFUSED")) {
			return {
				success: false,
				error: "Cannot connect to Sunshine. Is it running?",
			};
		}
		if (
			message.includes("self signed certificate") ||
			message.includes("CERT")
		) {
			return {
				success: false,
				error: "Certificate error. Sunshine uses self-signed certs by default.",
			};
		}

		return { success: false, error: message };
	}
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if Sunshine is running and credentials are valid.
 */
export async function checkConnection(): Promise<
	SunshineResult<{ version?: string }>
> {
	const config = await loadSunshineConfig();
	return sunshineRequest(config, "GET", "/api/apps");
}

/**
 * Check Sunshine connection with provided config (for testing before saving).
 */
export async function testConnection(
	config: SunshineConfig
): Promise<SunshineResult<{ version?: string }>> {
	// Temporarily enable for testing
	const testConfig = { ...config, enabled: true };
	return sunshineRequest(testConfig, "GET", "/api/apps");
}

/**
 * Get list of all registered applications in Sunshine.
 */
export async function listApps(): Promise<
	SunshineResult<{ apps: SunshineAppResponse[] }>
> {
	const config = await loadSunshineConfig();
	return sunshineRequest(config, "GET", "/api/apps");
}

/**
 * Add or update an application in Sunshine.
 *
 * @param app - Application configuration
 * @returns Result with the app index if successful
 */
export async function addApp(
	app: Omit<SunshineApp, "index"> & { index?: number }
): Promise<SunshineResult<{ index: number }>> {
	const config = await loadSunshineConfig();

	const appWithIndex: SunshineApp = {
		...app,
		index: app.index ?? -1, // -1 means create new
	};

	return sunshineRequest(config, "POST", "/api/apps", appWithIndex);
}

/**
 * Register an emulator game as a Sunshine application.
 *
 * @param gameName - Display name for the game
 * @param emulatorPath - Path to emulator executable
 * @param romPath - Path to ROM file
 * @param coverPath - Optional path to cover image
 */
export async function registerEmulatorGame(
	gameName: string,
	emulatorPath: string,
	romPath: string,
	launchArgs: string[],
	coverPath?: string
): Promise<SunshineResult<{ index: number }>> {
	// Build command string with ROM path substituted
	const args = launchArgs
		.map((arg) => (arg === "{ROM}" ? `"${romPath}"` : arg))
		.join(" ");

	const cmd = `"${emulatorPath}" ${args}`;

	const app: Omit<SunshineApp, "index"> = {
		name: gameName,
		cmd,
		"auto-detach": true,
		"wait-all": true,
		"exit-timeout": 5,
	};

	if (coverPath) {
		app["image-path"] = coverPath;
	}

	return addApp(app);
}

/**
 * Close the currently running application in Sunshine.
 */
export async function closeApp(): Promise<SunshineResult> {
	const config = await loadSunshineConfig();
	return sunshineRequest(config, "POST", "/api/apps/close");
}

/**
 * Delete an application from Sunshine by index.
 */
export async function deleteApp(index: number): Promise<SunshineResult> {
	const config = await loadSunshineConfig();
	return sunshineRequest(config, "DELETE", `/api/apps/${index}`);
}

/**
 * Find an existing app in Sunshine by name.
 */
export async function findAppByName(
	name: string
): Promise<SunshineResult<SunshineAppResponse | null>> {
	const result = await listApps();

	if (!result.success) {
		return { success: false, error: result.error };
	}

	const app = result.data?.apps.find((a) => a.name === name) ?? null;
	return { success: true, data: app };
}

/**
 * Get the moonlight-web-stream URL for embedding.
 */
export async function getMoonlightWebUrl(): Promise<string> {
	const config = await loadSunshineConfig();
	return config.moonlightWebUrl;
}

/**
 * Check if Sunshine streaming is available for a game.
 * Returns true if Sunshine is configured and enabled.
 */
export async function isSunshineAvailable(): Promise<boolean> {
	const config = await loadSunshineConfig();
	if (!config.enabled || !config.password) {
		return false;
	}

	const result = await checkConnection();
	return result.success;
}
