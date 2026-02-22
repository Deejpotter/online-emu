/**
 * Core TypeScript types for the Online Emulator server.
 * These types define the data structures used throughout the application
 * for games, inputs, WebSocket events, streaming, and user profiles.
 */

// =============================================================================
// User Profile Types
// =============================================================================

/**
 * A user profile for the local multi-user system.
 * Profiles are simple identifiers - no passwords or authentication.
 * Used to separate save files and preferences between users.
 */
export interface Profile {
	/** Unique identifier (UUID) */
	id: string;
	/** Display name shown on profile tile */
	name: string;
	/** Optional emoji avatar (default: 👤) */
	avatar?: string;
	/** ISO timestamp when profile was created */
	createdAt: string;
}

/**
 * Request body for creating a new profile.
 */
export interface CreateProfileRequest {
	name: string;
	avatar?: string;
}

// =============================================================================
// Game & ROM Types
// =============================================================================

/**
 * Supported emulator systems - all browser-based via EmulatorJS.
 *
 * Why browser-only: EmulatorJS uses WebAssembly for emulation cores, allowing
 * these systems to run entirely in the browser. More demanding systems (PS2, GameCube)
 * cannot run in-browser due to performance limitations and are not supported.
 *
 * This keeps the application simple for VPS deployment - no need for desktop
 * emulators, screen capture, or streaming infrastructure.
 */
export type EmulatorSystem =
	| "nes" // Nintendo Entertainment System (FCEUmm core)
	| "snes" // Super Nintendo (Snes9x core)
	| "gb" // Game Boy (Gambatte core)
	| "gba" // Game Boy Advance (mGBA core)
	| "n64" // Nintendo 64 (Mupen64Plus core)
	| "nds" // Nintendo DS (DeSmuME core)
	| "segaMD" // Sega Genesis/Mega Drive (Genesis Plus GX)
	| "segaMS" // Sega Master System
	| "segaGG" // Sega Game Gear
	| "segaCD" // Sega CD
	| "psx" // PlayStation 1 (PCSX ReARMed) - Note: Large games may crash browsers
	| "psp" // PlayStation Portable (PPSSPP core)
	| "atari2600" // Atari 2600
	| "arcade"; // Arcade (MAME core)

/**
 * Represents a game ROM in the library.
 *
 * Games are detected by scanning the roms/ directory for supported file extensions.
 * Each game is played through EmulatorJS in the browser - no external emulators needed.
 */
export interface Game {
	/** Unique identifier (UUID) */
	id: string;
	/** Display title */
	title: string;
	/** Target emulator system */
	system: EmulatorSystem;
	/** Relative path to ROM file from public/roms/ */
	romPath: string;
	/** Optional cover art path */
	coverArt?: string;
	/** File size in bytes */
	fileSize?: number;
	/** Last played timestamp (ISO 8601) */
	lastPlayed?: string;
	/** Play count */
	playCount?: number;
	/** Optional description or notes */
	description?: string;
}

/**
 * Metadata for the game library, stored in metadata.json.
 */
export interface GameLibrary {
	games: Game[];
	lastUpdated: string;
}

// =============================================================================
// Controller Input Types
// =============================================================================

/**
 * Standard controller buttons across different systems.
 * Mapped to EmulatorJS input codes.
 */
export type ControllerButton =
	| "A"
	| "B"
	| "X"
	| "Y" // Face buttons
	| "UP"
	| "DOWN"
	| "LEFT"
	| "RIGHT" // D-Pad
	| "START"
	| "SELECT" // Meta buttons
	| "L"
	| "R"
	| "L2"
	| "R2" // Shoulder buttons
	| "L3"
	| "R3" // Stick buttons (press)
	| "STICK_L"
	| "STICK_R"; // Analog sticks (special handling)

/**
 * Input event sent from mobile client to server.
 */
export interface InputEvent {
	/** Which button was pressed/released */
	button: ControllerButton;
	/** True = pressed, False = released */
	pressed: boolean;
	/** High-resolution timestamp from client */
	timestamp: number;
	/** Player number (1-4 for multiplayer) */
	playerId?: number;
}

/**
 * Analog stick input for N64/PS1 games.
 */
export interface AnalogInput {
	/** Which stick (left or right) */
	stick: "STICK_L" | "STICK_R";
	/** X-axis value (-1.0 to 1.0) */
	x: number;
	/** Y-axis value (-1.0 to 1.0) */
	y: number;
	/** High-resolution timestamp from client */
	timestamp: number;
	/** Player number (1-4 for multiplayer) */
	playerId?: number;
}

// =============================================================================
// WebSocket Event Types
// =============================================================================

/**
 * Client connection info for handshake.
 */
export interface ClientInfo {
	/** Unique client identifier */
	clientId: string;
	/** Client device type */
	deviceType: "mobile" | "browser" | "other";
	/** Requested player slot (1-4) */
	playerSlot?: number;
	/** Client capabilities */
	capabilities: {
		webrtc: boolean;
		haptics: boolean;
		gyroscope: boolean;
	};
}

/**
 * Server response to connection request.
 */
export interface ConnectionResponse {
	/** Whether connection was accepted */
	accepted: boolean;
	/** Assigned player number */
	playerId?: number;
	/** Current game info if one is active */
	currentGame?: Game;
	/** Server capabilities */
	serverInfo: {
		version: string;
		supportedSystems: EmulatorSystem[];
		maxPlayers: number;
	};
	/** Error message if rejected */
	error?: string;
}

/**
 * Game state sync event for keeping clients in sync.
 */
export interface GameSyncEvent {
	/** Current game being played */
	game: Game | null;
	/** Emulator state (playing, paused, menu) */
	state: "playing" | "paused" | "stopped";
	/** Connected players */
	players: {
		playerId: number;
		clientId: string;
		connected: boolean;
	}[];
}

// =============================================================================
// WebRTC Signaling Types
// =============================================================================

/**
 * WebRTC signaling message for connection setup.
 */
export interface SignalingMessage {
	type: "offer" | "answer" | "ice-candidate";
	/** Target client ID */
	targetClientId: string;
	/** Source client ID */
	sourceClientId: string;
	/** SDP or ICE candidate data */
	payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API success response wrapper.
 */
export interface ApiResponse<T> {
	success: true;
	data: T;
}

/**
 * Standard API error response wrapper.
 */
export interface ApiError {
	success: false;
	error: string;
	details?: unknown;
}

/**
 * Union type for all API responses.
 */
export type ApiResult<T> = ApiResponse<T> | ApiError;
