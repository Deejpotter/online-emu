/**
 * Game Library Management
 *
 * Handles reading, scanning, and managing the ROM library.
 * ROMs are stored in the configured games directory with structure:
 *   {GAMES_DIR}/{SystemName}/ROMs/
 *
 * Configure via GAMES_DIR environment variable or edit the path below.
 *
 * IMPORTANT: Only browser-compatible systems are supported.
 * EmulatorJS uses WebAssembly cores that run in the browser, which limits
 * us to older consoles (NES through PSX/N64). More demanding systems like
 * PS2 and GameCube cannot run in-browser and are not supported.
 */

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Game, GameLibrary, EmulatorSystem } from "@/types";

// Path to the games directory - configure this to your games folder
// Can also be set via GAMES_DIR environment variable
const GAMES_DIR = process.env.GAMES_DIR || "H:\\Games";

// Metadata is stored locally in the server's data directory
const DATA_DIR = path.join(process.cwd(), "data");
const METADATA_PATH = path.join(DATA_DIR, "metadata.json");

/**
 * File extensions recognized for each emulator system.
 * Used when scanning directories for ROMs.
 *
 * Why these systems: All are supported by EmulatorJS WebAssembly cores
 * and can run efficiently in modern browsers.
 */
const SYSTEM_EXTENSIONS: Record<EmulatorSystem, string[]> = {
	nes: [".nes", ".fds", ".zip"],
	snes: [".sfc", ".smc", ".zip"],
	gb: [".gb", ".gbc", ".zip"],
	gba: [".gba", ".zip"],
	n64: [".n64", ".z64", ".v64", ".zip"],
	nds: [".nds", ".zip"],
	segaMD: [".md", ".gen", ".bin", ".zip"],
	segaMS: [".sms", ".zip"],
	segaGG: [".gg", ".zip"],
	segaCD: [".iso", ".bin", ".cue", ".zip"],
	psx: [".bin", ".iso", ".cue", ".img", ".zip", ".pbp"],
	psp: [".iso", ".cso", ".zip", ".pbp"],
	atari2600: [".a26", ".bin", ".zip"],
	arcade: [".zip"],
};

/**
 * Map folder names in the games directory to EmulatorSystem IDs.
 * This allows flexible folder naming (e.g., "NES", "Genesis", "PS1").
 *
 * Why case-insensitive: Folder names are normalized to lowercase before matching,
 * so users can organize their ROMs however they prefer.
 */
const FOLDER_TO_SYSTEM: Record<string, EmulatorSystem> = {
	// Nintendo
	nes: "nes",
	snes: "snes",
	"super nintendo": "snes",
	gb: "gb",
	gbc: "gb",
	"game boy": "gb",
	"game boy color": "gb",
	gba: "gba",
	"game boy advance": "gba",
	n64: "n64",
	"nintendo 64": "n64",
	ds: "nds",
	nds: "nds",
	"nintendo ds": "nds",
	// Sega
	genesis: "segaMD",
	"mega drive": "segaMD",
	segamd: "segaMD",
	md: "segaMD",
	sms: "segaMS",
	"master system": "segaMS",
	segams: "segaMS",
	gg: "segaGG",
	gamegear: "segaGG",
	"game gear": "segaGG",
	segagg: "segaGG",
	segacd: "segaCD",
	"sega cd": "segaCD",
	// PlayStation
	psx: "psx",
	ps1: "psx",
	playstation: "psx",
	psp: "psp",
	"playstation portable": "psp",
	// Atari
	atari2600: "atari2600",
	"atari 2600": "atari2600",
	// Arcade
	arcade: "arcade",
	mame: "arcade",
};

export const SYSTEM_NAMES: Record<EmulatorSystem, string> = {
	nes: "Nintendo Entertainment System",
	snes: "Super Nintendo",
	gb: "Game Boy / Color",
	gba: "Game Boy Advance",
	n64: "Nintendo 64",
	nds: "Nintendo DS",
	segaMD: "Sega Genesis / Mega Drive",
	segaMS: "Sega Master System",
	segaGG: "Sega Game Gear",
	segaCD: "Sega CD",
	psx: "PlayStation",
	psp: "PlayStation Portable",
	atari2600: "Atari 2600",
	arcade: "Arcade (MAME)",
};

/**
 * Initialize the data directory for metadata storage.
 * The games directory is expected to already exist at GAMES_DIR.
 */
export async function initializeRomDirectory(): Promise<void> {
	// Create data directory for metadata
	await fs.mkdir(DATA_DIR, { recursive: true });

	// Create empty metadata file if it doesn't exist
	try {
		await fs.access(METADATA_PATH);
	} catch {
		const emptyLibrary: GameLibrary = {
			games: [],
			lastUpdated: new Date().toISOString(),
		};
		await fs.writeFile(METADATA_PATH, JSON.stringify(emptyLibrary, null, 2));
	}

	// Log the games directory being used
	console.log(`[GameLibrary] Using games directory: ${GAMES_DIR}`);
}

/**
 * Load the game library metadata from disk.
 */
export async function loadGameLibrary(): Promise<GameLibrary> {
	try {
		const data = await fs.readFile(METADATA_PATH, "utf-8");
		return JSON.parse(data) as GameLibrary;
	} catch {
		// Return empty library if file doesn't exist or is invalid
		return {
			games: [],
			lastUpdated: new Date().toISOString(),
		};
	}
}

/**
 * Save the game library metadata to disk.
 */
export async function saveGameLibrary(library: GameLibrary): Promise<void> {
	library.lastUpdated = new Date().toISOString();
	await fs.writeFile(METADATA_PATH, JSON.stringify(library, null, 2));
}

/**
 * Get all games from the library.
 */
export async function getAllGames(): Promise<Game[]> {
	const library = await loadGameLibrary();
	return library.games;
}

/**
 * Get games filtered by system.
 */
export async function getGamesBySystem(
	system: EmulatorSystem
): Promise<Game[]> {
	const library = await loadGameLibrary();
	return library.games.filter((game) => game.system === system);
}

/**
 * Get a single game by ID.
 */
export async function getGameById(id: string): Promise<Game | null> {
	const library = await loadGameLibrary();
	return library.games.find((game) => game.id === id) || null;
}

/**
 * Alias for getGameById - used by streaming API.
 */
export const getGame = getGameById;

/**
 * Convert a filename to a display title.
 * Removes extension, replaces underscores/hyphens with spaces, and title-cases.
 */
function filenameToTitle(filename: string): string {
	// Remove extension
	const name = filename.replace(/\.[^/.]+$/, "");

	// Replace underscores and hyphens with spaces
	const spaced = name.replace(/[_-]/g, " ");

	// Remove common ROM tags like (USA), [!], etc.
	const cleaned = spaced.replace(/\s*[\(\[].*?[\)\]]\s*/g, " ").trim();

	// Title case each word
	return cleaned
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

/**
 * Scan the ROM directories for new games and update the library.
 * Scans both:
 *   - {GAMES_DIR}/{FolderName}/ROMs/ (ROMs subfolder)
 *   - {GAMES_DIR}/{FolderName}/ (direct files in system folder)
 */
export async function scanForNewRoms(): Promise<{
	added: number;
	total: number;
}> {
	const library = await loadGameLibrary();
	const existingPaths = new Set(library.games.map((g) => g.romPath));
	let added = 0;

	/**
	 * Helper to scan a directory for ROM files.
	 */
	async function scanDirectory(
		dir: string,
		system: EmulatorSystem,
		relativeBase: string
	): Promise<void> {
		const validExtensions = SYSTEM_EXTENSIONS[system];

		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				// Skip directories (including the ROMs subfolder which is scanned separately)
				if (entry.isDirectory()) continue;

				const ext = path.extname(entry.name).toLowerCase();

				// Skip if not a valid ROM extension for this system
				if (!validExtensions.includes(ext)) continue;

				// Store path relative to GAMES_DIR for portability
				const romPath = path.join(relativeBase, entry.name);

				// Skip if already in library
				if (existingPaths.has(romPath)) continue;

				// Get file stats
				const filePath = path.join(dir, entry.name);
				const stats = await fs.stat(filePath);

				// Create new game entry - all games use EmulatorJS in browser
				const newGame: Game = {
					id: uuidv4(),
					title: filenameToTitle(entry.name),
					system,
					romPath,
					fileSize: stats.size,
					playCount: 0,
				};

				library.games.push(newGame);
				existingPaths.add(romPath);
				added++;
			}
		} catch {
			// Directory might not exist or be inaccessible
		}
	}

	try {
		// List all folders in the games directory
		const folders = await fs.readdir(GAMES_DIR);

		for (const folder of folders) {
			// Map folder name to system ID (case-insensitive)
			const system = FOLDER_TO_SYSTEM[folder.toLowerCase()];
			if (!system) {
				// Unknown system folder, skip it
				continue;
			}

			// Scan ROMs subfolder first (primary location)
			const romsSubfolder = path.join(GAMES_DIR, folder, "ROMs");
			await scanDirectory(romsSubfolder, system, path.join(folder, "ROMs"));

			// Also scan direct files in the system folder (secondary location)
			const systemFolder = path.join(GAMES_DIR, folder);
			await scanDirectory(systemFolder, system, folder);
		}
	} catch (err) {
		console.error(`[GameLibrary] Failed to scan games directory: ${err}`);
	}

	// Save updated library if we found new games
	if (added > 0) {
		await saveGameLibrary(library);
	}

	return { added, total: library.games.length };
}

/**
 * Update a game's metadata (e.g., after playing).
 */
export async function updateGame(
	id: string,
	updates: Partial<
		Pick<
			Game,
			"title" | "coverArt" | "description" | "lastPlayed" | "playCount"
		>
	>
): Promise<Game | null> {
	const library = await loadGameLibrary();
	const gameIndex = library.games.findIndex((g) => g.id === id);

	if (gameIndex === -1) return null;

	library.games[gameIndex] = {
		...library.games[gameIndex],
		...updates,
	};

	await saveGameLibrary(library);
	return library.games[gameIndex];
}

/**
 * Mark a game as played (updates lastPlayed and increments playCount).
 */
export async function markGameAsPlayed(id: string): Promise<Game | null> {
	const game = await getGameById(id);
	if (!game) return null;

	return updateGame(id, {
		lastPlayed: new Date().toISOString(),
		playCount: (game.playCount || 0) + 1,
	});
}

/**
 * Delete a game from the library (metadata only, not the ROM file).
 */
export async function deleteGame(id: string): Promise<boolean> {
	const library = await loadGameLibrary();
	const initialLength = library.games.length;

	library.games = library.games.filter((g) => g.id !== id);

	if (library.games.length < initialLength) {
		await saveGameLibrary(library);
		return true;
	}

	return false;
}

/**
 * Get all supported systems.
 */
export function getSupportedSystems(): EmulatorSystem[] {
	return Object.keys(SYSTEM_EXTENSIONS) as EmulatorSystem[];
}

/**
 * Get the full absolute path to a ROM file.
 * @param romPath - The relative path stored in the game metadata
 * @returns The full path to the ROM file
 */
export function getRomFullPath(romPath: string): string {
	return path.join(GAMES_DIR, romPath);
}

/**
 * Get the games directory path.
 */
export function getGamesDirectory(): string {
	return GAMES_DIR;
}
