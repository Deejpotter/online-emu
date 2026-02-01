/**
 * Socket.IO Server for Online Emulator
 *
 * Handles real-time communication between:
 * - Mobile clients (viewers) sending controller inputs
 * - Streaming pages (streamers) running EmulatorJS
 *
 * Manages input events, game state synchronization, and WebRTC signaling.
 */

import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
	ClientInfo,
	ConnectionResponse,
	GameSyncEvent,
	InputEvent,
	AnalogInput,
	SignalingMessage,
	Game,
} from "@/types";
import {
	getAllGames,
	getSupportedSystems,
	markGameAsPlayed,
} from "./game-library";
import {
	createSession,
	registerStreamer,
	registerViewer,
	handleDisconnect as handleStreamDisconnect,
	getStreamerForViewer,
	getViewersForStreamer,
	getSession,
} from "./streaming-manager";

// Type alias for our typed Socket.IO server
type TypedServer = SocketIOServer<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>;

type TypedSocket = Socket<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>;

// Server configuration
const MAX_PLAYERS = 4;
const SERVER_VERSION = "1.0.0";

// Global state
let io: TypedServer | null = null;
let currentGame: Game | null = null;
let gameState: "playing" | "paused" | "stopped" = "stopped";
const connectedPlayers: Map<number, string> = new Map(); // playerId -> clientId

/**
 * Find the next available player slot (1-4).
 */
function getNextPlayerSlot(): number | null {
	for (let i = 1; i <= MAX_PLAYERS; i++) {
		if (!connectedPlayers.has(i)) {
			return i;
		}
	}
	return null;
}

/**
 * Build the current game sync event.
 */
function buildGameSyncEvent(): GameSyncEvent {
	const players: GameSyncEvent["players"] = [];

	connectedPlayers.forEach((clientId, playerId) => {
		players.push({
			playerId,
			clientId,
			connected: true,
		});
	});

	return {
		game: currentGame,
		state: gameState,
		players,
	};
}

/**
 * Broadcast game state to all connected clients.
 */
function broadcastGameSync(): void {
	if (io) {
		io.emit("game_sync", buildGameSyncEvent());
	}
}

/**
 * Handle a new client connection.
 */
function handleConnection(socket: TypedSocket): void {
	console.log(`[Socket.IO] New connection: ${socket.id}`);

	// Handle connection request (handshake)
	socket.on("connect_request", async (data: ClientInfo) => {
		console.log(
			`[Socket.IO] Connection request from ${data.clientId} (${data.deviceType})`
		);

		// Try to get the requested player slot, or assign the next available one
		let playerId =
			data.playerSlot && !connectedPlayers.has(data.playerSlot)
				? data.playerSlot
				: getNextPlayerSlot();

		if (playerId === null) {
			// No slots available
			const response: ConnectionResponse = {
				accepted: false,
				serverInfo: {
					version: SERVER_VERSION,
					supportedSystems: getSupportedSystems(),
					maxPlayers: MAX_PLAYERS,
				},
				error: "All player slots are full. Maximum 4 players allowed.",
			};
			socket.emit("connect_response", response);
			return;
		}

		// Store socket data
		socket.data.clientId = data.clientId;
		socket.data.playerId = playerId;
		socket.data.deviceType = data.deviceType;

		// Register the player
		connectedPlayers.set(playerId, data.clientId);

		// Send acceptance response
		const response: ConnectionResponse = {
			accepted: true,
			playerId,
			currentGame: currentGame || undefined,
			serverInfo: {
				version: SERVER_VERSION,
				supportedSystems: getSupportedSystems(),
				maxPlayers: MAX_PLAYERS,
			},
		};
		socket.emit("connect_response", response);

		// Broadcast updated game state to all clients
		broadcastGameSync();

		console.log(`[Socket.IO] Player ${playerId} connected: ${data.clientId}`);
	});

	// Handle controller input
	socket.on("input", (data: InputEvent) => {
		// Add player ID if not present
		const inputWithPlayer: InputEvent = {
			...data,
			playerId: data.playerId || socket.data.playerId || 1,
		};

		// Log input for debugging
		console.log(
			`[Input] P${inputWithPlayer.playerId}: ${data.button} ${
				data.pressed ? "pressed" : "released"
			}`
		);

		// Forward to streaming page if this is a viewer
		const streamerSocketId = getStreamerForViewer(socket.id);
		if (streamerSocketId && io) {
			io.to(streamerSocketId).emit("remote_input" as any, inputWithPlayer);
		}
	});

	// Handle analog stick input
	socket.on("analog", (data: AnalogInput) => {
		const inputWithPlayer: AnalogInput = {
			...data,
			playerId: data.playerId || socket.data.playerId || 1,
		};

		// Log analog input
		console.log(
			`[Analog] P${inputWithPlayer.playerId}: ${data.stick} x=${data.x.toFixed(
				2
			)} y=${data.y.toFixed(2)}`
		);

		// Forward to streaming page if this is a viewer
		const streamerSocketId = getStreamerForViewer(socket.id);
		if (streamerSocketId && io) {
			io.to(streamerSocketId).emit("remote_analog" as any, inputWithPlayer);
		}
	});

	// Handle game load request
	socket.on("load_game", async (gameId: string) => {
		console.log(`[Socket.IO] Load game request: ${gameId}`);

		// Mark game as played
		const game = await markGameAsPlayed(gameId);

		if (!game) {
			socket.emit("error", `Game not found: ${gameId}`);
			return;
		}

		currentGame = game;
		gameState = "playing";

		// Broadcast to all clients
		broadcastGameSync();

		console.log(`[Socket.IO] Now playing: ${game.title}`);
	});

	// Handle pause/resume toggle
	socket.on("toggle_pause", () => {
		if (gameState === "playing") {
			gameState = "paused";
		} else if (gameState === "paused") {
			gameState = "playing";
		}

		broadcastGameSync();
		console.log(`[Socket.IO] Game state: ${gameState}`);
	});

	// Handle game list request
	socket.on("get_games", async () => {
		const games = await getAllGames();
		socket.emit("games_list", games);
	});

	// Handle WebRTC signaling
	socket.on("signal", (data: SignalingMessage) => {
		// Find the target socket and forward the signal
		const targetSocket = Array.from(io?.sockets.sockets.values() || []).find(
			(s) => s.data.clientId === data.targetClientId
		);

		if (targetSocket) {
			targetSocket.emit("signal", data);
		} else {
			socket.emit("error", `Target client not found: ${data.targetClientId}`);
		}
	});

	// Handle ping for latency measurement
	socket.on("ping", (timestamp: number) => {
		socket.emit("pong", timestamp);
	});

	// ==========================================================================
	// Streaming Events (WebRTC)
	// ==========================================================================

	// Streamer (browser page with EmulatorJS) registers with a session
	socket.on(
		"register_streamer" as any,
		({ sessionId }: { sessionId: string }) => {
			const success = registerStreamer(sessionId, socket.id);
			if (success) {
				socket.emit("streamer_registered" as any, { sessionId });
				console.log(`[Socket.IO] Streamer registered for session ${sessionId}`);
			} else {
				socket.emit("error", "Failed to register as streamer");
			}
		}
	);

	// Viewer (phone) joins a streaming session
	socket.on("join_stream" as any, ({ sessionId }: { sessionId: string }) => {
		const session = getSession(sessionId);
		if (!session) {
			socket.emit("error", "Streaming session not found");
			return;
		}

		const success = registerViewer(sessionId, socket.id);
		if (success) {
			socket.emit("stream_joined" as any, {
				sessionId,
				game: session.game,
			});

			// Notify the streamer that a viewer joined
			if (session.streamerSocketId && io) {
				io.to(session.streamerSocketId).emit("viewer_joined" as any, {
					viewerId: socket.id,
				});
			}

			console.log(`[Socket.IO] Viewer ${socket.id} joined stream ${sessionId}`);
		} else {
			socket.emit("error", "Failed to join stream");
		}
	});

	// Streamer sends WebRTC signal to viewer
	socket.on(
		"stream_signal" as any,
		({ viewerId, signal }: { viewerId: string; signal: any }) => {
			if (io) {
				io.to(viewerId).emit("stream_signal" as any, { signal });
			}
		}
	);

	// Viewer sends WebRTC signal to streamer
	socket.on("viewer_signal" as any, ({ signal }: { signal: any }) => {
		const streamerSocketId = getStreamerForViewer(socket.id);
		if (streamerSocketId && io) {
			io.to(streamerSocketId).emit("viewer_signal" as any, {
				viewerId: socket.id,
				signal,
			});
		}
	});

	// Handle disconnection
	socket.on("disconnect", (reason) => {
		const playerId = socket.data.playerId;

		if (playerId !== undefined) {
			connectedPlayers.delete(playerId);
			broadcastGameSync();
		}

		// Clean up streaming session
		handleStreamDisconnect(socket.id);

		console.log(`[Socket.IO] Disconnected: ${socket.id} (${reason})`);
	});
}

/**
 * Initialize the Socket.IO server.
 * Call this with the HTTP server instance from the custom server.
 */
export function initSocketServer(httpServer: HttpServer): TypedServer {
	io = new SocketIOServer<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>(httpServer, {
		cors: {
			origin: "*", // In production, restrict this to your mobile app's origin
			methods: ["GET", "POST"],
		},
		// Connection settings optimized for gaming
		pingInterval: 10000, // 10 seconds
		pingTimeout: 5000, // 5 seconds
		transports: ["websocket", "polling"],
	});

	// Handle new connections
	io.on("connection", handleConnection);

	console.log("[Socket.IO] Server initialized");

	return io;
}

/**
 * Get the Socket.IO server instance.
 */
export function getSocketServer(): TypedServer | null {
	return io;
}

/**
 * Get the current game state (for API use).
 */
export function getCurrentGameState(): GameSyncEvent {
	return buildGameSyncEvent();
}

/**
 * Set the current game (for API use).
 */
export function setCurrentGame(game: Game | null): void {
	currentGame = game;
	if (game) {
		gameState = "playing";
	} else {
		gameState = "stopped";
	}
	broadcastGameSync();
}
