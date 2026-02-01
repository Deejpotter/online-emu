/**
 * Streaming Manager
 *
 * Manages WebRTC streaming sessions between the server's streaming page
 * (which runs EmulatorJS) and mobile clients. Handles:
 * - Session creation/destruction
 * - WebRTC signaling relay
 * - Input forwarding from phone to emulator
 *
 * Architecture:
 * [Phone] <--WebRTC--> [Server Browser Window with EmulatorJS]
 *            |
 *    [Socket.IO signaling]
 *
 * For external emulators (PS2/GameCube):
 * [Phone] <--WebRTC--> [Server Browser Window with Screen Capture]
 *            |
 *    [Virtual Gamepad for input]
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import type { Game, SignalingMessage, InputEvent, AnalogInput } from "@/types";
import { isExternalSystem } from "@/types";
import {
	createVirtualController,
	destroyVirtualController,
	handleButtonInput,
	handleAnalogInput,
} from "./virtual-gamepad";
import {
	launchEmulator,
	stopEmulator,
	isEmulatorRunning,
} from "./emulator-launcher";

/**
 * Represents an active streaming session.
 * Each session has one streaming source (browser with EmulatorJS or screen capture)
 * and one or more viewers (phones).
 */
export interface StreamingSession {
	/** Unique session ID */
	id: string;
	/** Game being streamed */
	game: Game;
	/** Socket ID of the streaming page (WebRTC source) */
	streamerSocketId: string | null;
	/** Socket IDs of connected viewers (phones) */
	viewerSocketIds: Set<string>;
	/** Session state */
	state: "waiting" | "streaming" | "ended";
	/** Creation timestamp */
	createdAt: Date;
	/** Whether this is an external emulator session (PS2/GC) */
	isExternal: boolean;
}

// Active streaming sessions, keyed by session ID
const sessions = new Map<string, StreamingSession>();

// Map from socket ID to session ID for quick lookup
const socketToSession = new Map<string, string>();

/**
 * Create a new streaming session for a game.
 * Returns the session ID that the streaming page should connect with.
 * For external systems (PS2/GC), also launches the emulator and creates a virtual controller.
 */
export async function createSession(game: Game): Promise<{
	sessionId: string;
	isExternal: boolean;
	error?: string;
}> {
	const sessionId = `stream_${game.id}_${Date.now()}`;
	const isExternal = isExternalSystem(game.system);

	// For external systems, launch the emulator
	if (isExternal) {
		const result = await launchEmulator(sessionId, game);
		if (!result.success) {
			return {
				sessionId: "",
				isExternal: true,
				error: result.error || "Failed to launch emulator",
			};
		}

		// Create virtual controller for this session
		createVirtualController(sessionId);
	}

	const session: StreamingSession = {
		id: sessionId,
		game,
		streamerSocketId: null,
		viewerSocketIds: new Set(),
		state: "waiting",
		createdAt: new Date(),
		isExternal,
	};

	sessions.set(sessionId, session);
	console.log(
		`[Streaming] Created ${
			isExternal ? "external" : "internal"
		} session ${sessionId} for game: ${game.title}`
	);

	return { sessionId, isExternal };
}

/**
 * Register a streaming page (the WebRTC source with EmulatorJS).
 * Called when the streaming browser page connects.
 */
export function registerStreamer(sessionId: string, socketId: string): boolean {
	const session = sessions.get(sessionId);

	if (!session) {
		console.warn(`[Streaming] Session not found: ${sessionId}`);
		return false;
	}

	if (session.streamerSocketId) {
		console.warn(`[Streaming] Session ${sessionId} already has a streamer`);
		return false;
	}

	session.streamerSocketId = socketId;
	session.state = "streaming";
	socketToSession.set(socketId, sessionId);

	console.log(`[Streaming] Streamer registered for session ${sessionId}`);
	return true;
}

/**
 * Register a viewer (phone) to a streaming session.
 */
export function registerViewer(sessionId: string, socketId: string): boolean {
	const session = sessions.get(sessionId);

	if (!session) {
		console.warn(`[Streaming] Session not found: ${sessionId}`);
		return false;
	}

	session.viewerSocketIds.add(socketId);
	socketToSession.set(socketId, sessionId);

	console.log(`[Streaming] Viewer ${socketId} joined session ${sessionId}`);
	return true;
}

/**
 * Get the streaming session for a socket.
 */
export function getSessionForSocket(socketId: string): StreamingSession | null {
	const sessionId = socketToSession.get(socketId);
	return sessionId ? sessions.get(sessionId) || null : null;
}

/**
 * Get the streamer socket ID for a viewer.
 * Used to relay WebRTC signals from phone to streaming page.
 */
export function getStreamerForViewer(viewerSocketId: string): string | null {
	const session = getSessionForSocket(viewerSocketId);
	return session?.streamerSocketId || null;
}

/**
 * Get all viewer socket IDs for a streamer.
 * Used to relay WebRTC signals from streaming page to phones.
 */
export function getViewersForStreamer(streamerSocketId: string): string[] {
	const session = getSessionForSocket(streamerSocketId);
	return session ? Array.from(session.viewerSocketIds) : [];
}

/**
 * Handle socket disconnection - cleanup session if needed.
 */
export function handleDisconnect(socketId: string): void {
	const sessionId = socketToSession.get(socketId);
	if (!sessionId) return;

	const session = sessions.get(sessionId);
	if (!session) return;

	// Remove from socket mapping
	socketToSession.delete(socketId);

	// Check if this was the streamer
	if (session.streamerSocketId === socketId) {
		console.log(
			`[Streaming] Streamer disconnected, ending session ${sessionId}`
		);
		// End the session - notify all viewers
		session.state = "ended";
		session.streamerSocketId = null;

		// Clean up external emulator resources
		if (session.isExternal) {
			destroyVirtualController(sessionId);
			stopEmulator(sessionId);
		}

		// Cleanup viewers
		session.viewerSocketIds.forEach((viewerId) => {
			socketToSession.delete(viewerId);
		});
		session.viewerSocketIds.clear();

		// Remove session after a delay (allow reconnection)
		setTimeout(() => {
			if (sessions.get(sessionId)?.state === "ended") {
				sessions.delete(sessionId);
				console.log(`[Streaming] Session ${sessionId} cleaned up`);
			}
		}, 5000);
	} else {
		// Just a viewer disconnected
		session.viewerSocketIds.delete(socketId);
		console.log(`[Streaming] Viewer ${socketId} left session ${sessionId}`);
	}
}

/**
 * Get session by ID (for API routes).
 */
export function getSession(sessionId: string): StreamingSession | null {
	return sessions.get(sessionId) || null;
}

/**
 * Get all active sessions (for debugging/admin).
 */
export function getAllSessions(): StreamingSession[] {
	return Array.from(sessions.values());
}

/**
 * Forward an input event to the streaming page or virtual gamepad.
 * For internal sessions: forward to streaming page (EmulatorJS).
 * For external sessions: send to virtual gamepad.
 */
export function forwardInput(
	io: SocketIOServer,
	viewerSocketId: string,
	input: InputEvent
): void {
	const session = getSessionForSocket(viewerSocketId);
	if (!session) return;

	if (session.isExternal) {
		// External session: use virtual gamepad
		handleButtonInput(session.id, input);
	} else {
		// Internal session: forward to EmulatorJS
		const streamerSocketId = getStreamerForViewer(viewerSocketId);
		if (streamerSocketId) {
			io.to(streamerSocketId).emit("remote_input", input);
		}
	}
}

/**
 * Forward an analog input event to the streaming page or virtual gamepad.
 */
export function forwardAnalogInput(
	io: SocketIOServer,
	viewerSocketId: string,
	input: AnalogInput
): void {
	const session = getSessionForSocket(viewerSocketId);
	if (!session) return;

	if (session.isExternal) {
		// External session: use virtual gamepad
		handleAnalogInput(session.id, input);
	} else {
		// Internal session: forward to EmulatorJS
		const streamerSocketId = getStreamerForViewer(viewerSocketId);
		if (streamerSocketId) {
			io.to(streamerSocketId).emit("remote_analog", input);
		}
	}
}

/**
 * Relay WebRTC signaling message between streamer and viewer.
 */
export function relaySignal(
	io: SocketIOServer,
	fromSocketId: string,
	signal: SignalingMessage
): void {
	const session = getSessionForSocket(fromSocketId);
	if (!session) return;

	// Determine target
	let targetSocketId: string | null = null;

	if (fromSocketId === session.streamerSocketId) {
		// From streamer to specific viewer
		targetSocketId = signal.targetClientId;
	} else if (session.viewerSocketIds.has(fromSocketId)) {
		// From viewer to streamer
		targetSocketId = session.streamerSocketId;
	}

	if (targetSocketId) {
		io.to(targetSocketId).emit("signal", {
			...signal,
			sourceClientId: fromSocketId,
		});
	}
}
