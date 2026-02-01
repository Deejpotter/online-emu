/**
 * Stream Content Component
 *
 * The main streaming component that:
 * 1. Loads a game in EmulatorJS (via iframe for React isolation)
 * 2. Captures the canvas as a video stream
 * 3. Establishes WebRTC connection with the phone
 * 4. Receives controller inputs and forwards them to the emulator
 *
 * This page runs in a browser window on the server PC.
 * The phone only receives the video stream - no emulation happens there.
 *
 * IMPORTANT: EmulatorJS runs in an iframe because it manipulates the DOM
 * directly, which conflicts with React's virtual DOM.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";
import type { Game, EmulatorSystem, InputEvent, AnalogInput } from "@/types";

/**
 * Message types sent TO the emulator iframe
 */
interface EmulatorInputMessage {
	type: "input";
	button: string;
	pressed: boolean;
	playerId?: number;
}

interface EmulatorAnalogMessage {
	type: "analog";
	stick: "left" | "right";
	x: number;
	y: number;
	playerId?: number;
}

interface EmulatorControlMessage {
	type: "saveState" | "loadState" | "pause" | "resume" | "getCanvas";
}

type EmulatorOutgoingMessage =
	| EmulatorInputMessage
	| EmulatorAnalogMessage
	| EmulatorControlMessage;

/**
 * Message types received FROM the emulator iframe
 */
interface EmulatorReadyMessage {
	type: "ready";
	width: number;
	height: number;
}

interface EmulatorErrorMessage {
	type: "error";
	message: string;
}

interface EmulatorStateMessage {
	type: "stateChanged";
	state: "playing" | "paused" | "loading";
}

type EmulatorIncomingMessage =
	| EmulatorReadyMessage
	| EmulatorErrorMessage
	| EmulatorStateMessage;

/**
 * Map system IDs to EmulatorJS core names.
 * External systems (ps2, gamecube) are included for type completeness
 * but will never be used in this component (they use /capture instead).
 */
const SYSTEM_TO_CORE: Record<EmulatorSystem, string> = {
	nes: "nes",
	snes: "snes",
	gb: "gb",
	gba: "gba",
	n64: "n64",
	nds: "nds",
	segaMD: "segaMD",
	segaMS: "segaMS",
	segaGG: "segaGG",
	segaCD: "segaCD",
	psx: "psx",
	psp: "psp",
	atari2600: "atari2600",
	arcade: "arcade",
	// External systems - not used in EmulatorJS but included for type safety
	ps2: "psx", // Fallback (won't be used)
	gamecube: "n64", // Fallback (won't be used)
};

/**
 * Connection states for the streaming page.
 */
type StreamState = "loading" | "connecting" | "waiting" | "streaming" | "error";

export default function StreamContent() {
	const searchParams = useSearchParams();
	const [game, setGame] = useState<Game | null>(null);
	const [streamState, setStreamState] = useState<StreamState>("loading");
	const [error, setError] = useState<string | null>(null);
	const [viewerCount, setViewerCount] = useState(0);

	const iframeRef = useRef<HTMLIFrameElement>(null);
	const socketRef = useRef<Socket | null>(null);
	const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
	const canvasStreamRef = useRef<MediaStream | null>(null);
	const emulatorReadyRef = useRef(false);

	// Get params from URL
	const sessionId = searchParams.get("session");
	const gameId = searchParams.get("game");

	/**
	 * Send a message to the emulator iframe
	 */
	const sendToEmulator = useCallback((message: EmulatorOutgoingMessage) => {
		if (iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.postMessage(message, "*");
		}
	}, []);

	/**
	 * Forward a button input to the emulator iframe.
	 * Called when phone sends input events via Socket.IO.
	 */
	const injectInput = useCallback(
		(input: InputEvent) => {
			if (!emulatorReadyRef.current) return;

			sendToEmulator({
				type: "input",
				button: input.button.toLowerCase(),
				pressed: input.pressed,
				playerId: input.playerId,
			});
		},
		[sendToEmulator]
	);

	/**
	 * Handle messages from the emulator iframe
	 */
	const handleEmulatorMessage = useCallback(
		(event: MessageEvent<EmulatorIncomingMessage>) => {
			// Basic origin check
			if (!event.origin.includes(window.location.host)) {
				return;
			}

			const data = event.data;
			if (!data || typeof data.type !== "string") return;

			switch (data.type) {
				case "ready":
					console.log("[Stream] Emulator ready:", data.width, "x", data.height);
					emulatorReadyRef.current = true;
					setStreamState("streaming");

					// Capture the iframe's canvas after a short delay
					setTimeout(() => {
						captureIframeCanvas();
					}, 500);
					break;

				case "error":
					console.error("[Stream] Emulator error:", data.message);
					setError(data.message);
					setStreamState("error");
					break;

				case "stateChanged":
					console.log("[Stream] Emulator state:", data.state);
					if (data.state === "playing" && !emulatorReadyRef.current) {
						emulatorReadyRef.current = true;
						setStreamState("streaming");
					}
					break;
			}
		},
		[]
	);

	/**
	 * Capture the EmulatorJS canvas from the iframe as a MediaStream for WebRTC.
	 * 
	 * NOTE: Due to same-origin policy, we can only capture the iframe's canvas
	 * if the iframe is same-origin. Since we serve emulator.html from the same
	 * server, this should work. If not, we'd need to use window capture instead.
	 */
	const captureIframeCanvas = useCallback(() => {
		if (!iframeRef.current) {
			console.warn("[Stream] Iframe not ready");
			return null;
		}

		try {
			// Try to access the iframe's document
			const iframeDoc = iframeRef.current.contentDocument;
			if (!iframeDoc) {
				console.warn("[Stream] Cannot access iframe document (cross-origin?)");
				// Fall back to window capture if available
				return captureViaDisplayMedia();
			}

			// Find the canvas in the iframe
			const canvas = iframeDoc.querySelector("#game canvas") as HTMLCanvasElement;
			if (!canvas) {
				console.warn("[Stream] Canvas not found in iframe");
				return null;
			}

			// Capture at 60fps for smooth gameplay
			const stream = canvas.captureStream(60);
			canvasStreamRef.current = stream;

			console.log("[Stream] Canvas captured from iframe successfully");
			return stream;
		} catch (err) {
			console.warn("[Stream] Failed to access iframe canvas:", err);
			return captureViaDisplayMedia();
		}
	}, []);

	/**
	 * Fallback: Use getDisplayMedia to capture the window.
	 * This requires user interaction and permission.
	 */
	const captureViaDisplayMedia = useCallback(async () => {
		try {
			console.log("[Stream] Attempting window capture via getDisplayMedia");
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: {
					displaySurface: "browser",
					frameRate: 60,
				},
				audio: false,
			});
			canvasStreamRef.current = stream;
			console.log("[Stream] Window captured via getDisplayMedia");
			return stream;
		} catch (err) {
			console.error("[Stream] Display media capture failed:", err);
			return null;
		}
	}, []);

	/**
	 * Create a WebRTC peer connection for a viewer (phone).
	 */
	const createPeerConnection = useCallback(
		(viewerId: string) => {
			const socket = socketRef.current;
			if (!socket) return;

			let stream = canvasStreamRef.current;
			if (!stream) {
				console.error("[Stream] Cannot create peer - no canvas stream yet");
				return;
			}

			// Create peer as initiator (we send video, phone receives)
			const peer = new Peer({
				initiator: true,
				trickle: true,
				stream,
				config: {
					iceServers: [
						{ urls: "stun:stun.l.google.com:19302" },
						{ urls: "stun:stun1.l.google.com:19302" },
					],
				},
			});

			peer.on("signal", (data) => {
				// Send signaling data to viewer via server
				socket.emit("stream_signal", {
					viewerId,
					signal: data,
				});
			});

			peer.on("connect", () => {
				console.log(`[Stream] Connected to viewer ${viewerId}`);
				setViewerCount((prev) => prev + 1);
			});

			peer.on("close", () => {
				console.log(`[Stream] Viewer ${viewerId} disconnected`);
				peersRef.current.delete(viewerId);
				setViewerCount((prev) => Math.max(0, prev - 1));
			});

			peer.on("error", (err) => {
				console.error(`[Stream] Peer error with ${viewerId}:`, err);
				peersRef.current.delete(viewerId);
			});

			peersRef.current.set(viewerId, peer);
			console.log(`[Stream] Peer created for viewer ${viewerId}`);
		},
		[]
	);

	/**
	 * Build the iframe URL with game parameters
	 */
	const getEmulatorUrl = useCallback(() => {
		if (!game) return "";

		const params = new URLSearchParams({
			gameUrl: `/api/roms/${game.romPath}`,
			core: SYSTEM_TO_CORE[game.system] || game.system,
			system: game.system,
		});

		return `/emulator.html?${params.toString()}`;
	}, [game]);

	/**
	 * Connect to Socket.IO server and register as streamer.
	 */
	useEffect(() => {
		if (!sessionId || !gameId) {
			setError("Missing session or game ID");
			setStreamState("error");
			return;
		}

		// Fetch game data
		async function init() {
			try {
				// Fetch game info
				const response = await fetch(`/api/games/${gameId}`);
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || "Failed to load game");
				}

				setGame(result.data.game);
				setStreamState("connecting");

				// Connect to Socket.IO
				const socket = io({
					query: {
						role: "streamer",
						sessionId,
					},
				});

				socketRef.current = socket;

				socket.on("connect", () => {
					console.log("[Stream] Connected to server");
					socket.emit("register_streamer", { sessionId });
					setStreamState("waiting");
				});

				// Handle viewer joining - create WebRTC connection
				socket.on("viewer_joined", ({ viewerId }) => {
					console.log(`[Stream] Viewer joined: ${viewerId}`);
					createPeerConnection(viewerId);
				});

				// Handle WebRTC signaling from viewer
				socket.on("viewer_signal", ({ viewerId, signal }) => {
					const peer = peersRef.current.get(viewerId);
					if (peer) {
						peer.signal(signal);
					}
				});

				// Handle remote inputs from phone
				socket.on("remote_input", (input: InputEvent) => {
					injectInput(input);
				});

				socket.on("remote_analog", (input: AnalogInput) => {
					injectAnalogInput(input);
				});

				socket.on("disconnect", () => {
					console.log("[Stream] Disconnected from server");
					setStreamState("error");
					setError("Lost connection to server");
				});
			} catch (err) {
				console.error("Failed to initialize stream:", err);
				setError(err instanceof Error ? err.message : "Failed to initialize");
				setStreamState("error");
			}
		}

		init();

		return () => {
			// Cleanup on unmount
			peersRef.current.forEach((peer) => peer.destroy());
			peersRef.current.clear();
			socketRef.current?.disconnect();
		};
	}, [sessionId, gameId, createPeerConnection, injectInput, injectAnalogInput]);

	/**
	 * Set up message listener for emulator iframe communication.
	 */
	useEffect(() => {
		window.addEventListener("message", handleEmulatorMessage);

		return () => {
			window.removeEventListener("message", handleEmulatorMessage);
		};
	}, [handleEmulatorMessage]);

	// Error state
	if (streamState === "error") {
		return (
			<div className="min-h-screen bg-black flex items-center justify-center">
				<div className="text-center text-white">
					<div className="text-6xl mb-4">❌</div>
					<h1 className="text-2xl font-bold mb-2">Stream Error</h1>
					<p className="text-gray-400">{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-black">
			{/* Status bar - only show when not streaming */}
			{streamState !== "streaming" && (
				<div className="fixed top-0 left-0 right-0 bg-gray-900/90 p-4 z-50">
					<div className="flex items-center justify-between max-w-4xl mx-auto">
						<div className="flex items-center gap-4">
							<div
								className={`w-3 h-3 rounded-full ${
									streamState === "waiting"
										? "bg-yellow-500 animate-pulse"
										: streamState === "connecting"
										? "bg-blue-500 animate-pulse"
										: "bg-green-500"
								}`}
							/>
							<span className="text-white">
								{streamState === "loading" && "Loading game..."}
								{streamState === "connecting" && "Connecting to server..."}
								{streamState === "waiting" && "Waiting for phone to connect..."}
							</span>
						</div>
						{game && (
							<span className="text-gray-400 text-sm">{game.title}</span>
						)}
					</div>
				</div>
			)}

			{/* Viewer count overlay */}
			{streamState === "streaming" && (
				<div className="fixed top-4 right-4 bg-black/50 px-3 py-1 rounded-full z-50">
					<span className="text-white text-sm">
						📱 {viewerCount} viewer{viewerCount !== 1 ? "s" : ""}
					</span>
				</div>
			)}

			{/* EmulatorJS iframe - takes full screen */}
			{game && (
				<iframe
					ref={iframeRef}
					src={getEmulatorUrl()}
					className="w-full h-screen border-0"
					title={`${game.title} - EmulatorJS Stream`}
					allow="autoplay; gamepad; fullscreen"
					sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
					style={{ background: "#000" }}
				/>
			)}
		</div>
	);
}
}
