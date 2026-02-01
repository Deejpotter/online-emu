/**
 * Capture Content Component
 *
 * The main screen capture component that:
 * 1. Uses getDisplayMedia to capture any window (emulator)
 * 2. Establishes WebRTC connection with the phone
 * 3. Forwards controller inputs to the virtual gamepad service
 *
 * This page runs in a browser window on the server PC.
 * The user must manually select the emulator window when prompted.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";
import type { Game } from "@/types";

/**
 * Connection states for the capture page.
 */
type CaptureState =
	| "loading"
	| "ready"
	| "prompting"
	| "capturing"
	| "waiting"
	| "streaming"
	| "error";

export default function CaptureContent() {
	const searchParams = useSearchParams();
	const [game, setGame] = useState<Game | null>(null);
	const [captureState, setCaptureState] = useState<CaptureState>("loading");
	const [error, setError] = useState<string | null>(null);
	const [viewerCount, setViewerCount] = useState(0);
	const [captureInfo, setCaptureInfo] = useState<string>("");

	const videoRef = useRef<HTMLVideoElement>(null);
	const socketRef = useRef<Socket | null>(null);
	const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
	const displayStreamRef = useRef<MediaStream | null>(null);

	// Get params from URL
	const sessionId = searchParams.get("session");
	const gameId = searchParams.get("game");

	/**
	 * Start screen capture using getDisplayMedia.
	 * This prompts the user to select a window/screen to capture.
	 */
	const startCapture = useCallback(async () => {
		setCaptureState("prompting");

		try {
			// Request screen capture with video and audio
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: {
					displaySurface: "window", // Prefer window capture
					frameRate: { ideal: 60, max: 60 },
				},
				audio: true, // Capture game audio if available
			});

			displayStreamRef.current = stream;

			// Show preview in video element
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
			}

			// Get info about what's being captured
			const videoTrack = stream.getVideoTracks()[0];
			const settings = videoTrack.getSettings();
			setCaptureInfo(
				`Capturing: ${settings.displaySurface || "unknown"} at ${
					settings.width
				}x${settings.height}`
			);

			// Handle user stopping the capture via browser UI
			videoTrack.onended = () => {
				console.log("[Capture] User stopped screen sharing");
				setCaptureState("ready");
				displayStreamRef.current = null;
			};

			setCaptureState("capturing");
			console.log("[Capture] Screen capture started");

			return stream;
		} catch (err) {
			console.error("[Capture] Failed to start screen capture:", err);
			if ((err as Error).name === "NotAllowedError") {
				setError(
					"Screen capture was denied. Please allow access and try again."
				);
			} else {
				setError(`Failed to start capture: ${(err as Error).message}`);
			}
			setCaptureState("ready");
			return null;
		}
	}, []);

	/**
	 * Stop screen capture and release resources.
	 */
	const stopCapture = useCallback(() => {
		if (displayStreamRef.current) {
			displayStreamRef.current.getTracks().forEach((track) => track.stop());
			displayStreamRef.current = null;
		}

		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}

		setCaptureState("ready");
		setCaptureInfo("");
	}, []);

	/**
	 * Create a WebRTC peer connection for a viewer (phone).
	 */
	const createPeerConnection = useCallback((viewerId: string) => {
		const socket = socketRef.current;
		const stream = displayStreamRef.current;

		if (!socket) {
			console.error("[Capture] No socket connection");
			return;
		}

		if (!stream) {
			console.error("[Capture] No capture stream available");
			// Notify viewer that capture needs to start
			socket.emit("capture_not_ready", { viewerId });
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
			console.log(`[Capture] Connected to viewer ${viewerId}`);
			setViewerCount((prev) => prev + 1);
			setCaptureState("streaming");
		});

		peer.on("close", () => {
			console.log(`[Capture] Viewer ${viewerId} disconnected`);
			peersRef.current.delete(viewerId);
			setViewerCount((prev) => Math.max(0, prev - 1));
			if (peersRef.current.size === 0) {
				setCaptureState("capturing");
			}
		});

		peer.on("error", (err) => {
			console.error(`[Capture] Peer error with ${viewerId}:`, err);
			peersRef.current.delete(viewerId);
		});

		peersRef.current.set(viewerId, peer);
		console.log(`[Capture] Peer created for viewer ${viewerId}`);
	}, []);

	/**
	 * Initialize the page: fetch game info and connect to Socket.IO.
	 */
	useEffect(() => {
		// Copy ref at effect start for cleanup (React lint rule)
		const peersAtEffectStart = peersRef.current;

		if (!sessionId || !gameId) {
			setError("Missing session or game ID");
			setCaptureState("error");
			return;
		}

		async function init() {
			try {
				// Fetch game info
				const response = await fetch(`/api/games/${gameId}`);
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || "Failed to load game");
				}

				setGame(result.data.game);
				setCaptureState("ready");

				// Connect to Socket.IO
				const socket = io({
					query: {
						role: "streamer",
						sessionId,
						captureMode: "external", // Indicate this is external emulator mode
					},
				});

				socketRef.current = socket;

				socket.on("connect", () => {
					console.log("[Capture] Connected to server");
					socket.emit("register_streamer", {
						sessionId,
						isExternal: true,
					});
				});

				// Handle viewer joining - create WebRTC connection
				socket.on("viewer_joined", ({ viewerId }) => {
					console.log(`[Capture] Viewer joined: ${viewerId}`);
					createPeerConnection(viewerId);
				});

				// Handle WebRTC signaling from viewer
				socket.on("viewer_signal", ({ viewerId, signal }) => {
					const peer = peersRef.current.get(viewerId);
					if (peer) {
						peer.signal(signal);
					}
				});

				// Handle controller inputs - these are forwarded to virtual gamepad
				socket.on("input", (data) => {
					// Input handling is done server-side via virtual gamepad
					// This event is for logging/debugging
					console.debug("[Capture] Input received:", data.button, data.pressed);
				});

				socket.on("disconnect", () => {
					console.log("[Capture] Disconnected from server");
				});

				socket.on("connect_error", (err) => {
					console.error("[Capture] Connection error:", err);
					setError(`Connection error: ${err.message}`);
				});
			} catch (err) {
				console.error("[Capture] Initialization error:", err);
				setError(err instanceof Error ? err.message : "Failed to initialize");
				setCaptureState("error");
			}
		}

		init();

		// Cleanup on unmount
		return () => {
			stopCapture();

			// Close all peer connections using the ref captured at effect start
			peersAtEffectStart.forEach((peer) => {
				try {
					peer.destroy();
				} catch {
					// Ignore errors during cleanup
				}
			});
			peersAtEffectStart.clear();

			// Disconnect socket
			if (socketRef.current) {
				socketRef.current.disconnect();
				socketRef.current = null;
			}
		};
	}, [sessionId, gameId, createPeerConnection, stopCapture]);

	// Render loading state
	if (captureState === "loading") {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
				<p className="text-xl">Loading game information...</p>
			</div>
		);
	}

	// Render error state
	if (captureState === "error" || error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
				<div className="text-red-500 text-6xl mb-4">⚠️</div>
				<h1 className="text-2xl font-bold mb-2">Error</h1>
				<p className="text-gray-400 mb-4">
					{error || "An unknown error occurred"}
				</p>
				<button
					onClick={() => window.location.reload()}
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
				>
					Retry
				</button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-900 text-white p-4">
			{/* Header */}
			<div className="max-w-4xl mx-auto">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-2xl font-bold">Screen Capture</h1>
						<p className="text-gray-400">
							{game?.title || "External Game"} ({game?.system?.toUpperCase()})
						</p>
					</div>
					<div className="text-right">
						<div className="text-sm text-gray-400">Viewers</div>
						<div className="text-2xl font-bold">{viewerCount}</div>
					</div>
				</div>

				{/* Status Card */}
				<div className="bg-gray-800 rounded-lg p-6 mb-6">
					<div className="flex items-center gap-3 mb-4">
						<div
							className={`w-3 h-3 rounded-full ${
								captureState === "streaming"
									? "bg-green-500 animate-pulse"
									: captureState === "capturing"
									? "bg-yellow-500"
									: "bg-gray-500"
							}`}
						/>
						<span className="text-lg font-medium">
							{captureState === "ready" && "Ready to Capture"}
							{captureState === "prompting" && "Select a window..."}
							{captureState === "capturing" &&
								"Capturing - Waiting for viewers"}
							{captureState === "streaming" && "Streaming to phone"}
						</span>
					</div>

					{captureInfo && (
						<p className="text-sm text-gray-400 mb-4">{captureInfo}</p>
					)}

					{/* Action buttons */}
					<div className="flex gap-4">
						{(captureState === "ready" || captureState === "prompting") && (
							<button
								onClick={startCapture}
								disabled={captureState === "prompting"}
								className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
							>
								{captureState === "prompting"
									? "Select window..."
									: "Start Capture"}
							</button>
						)}

						{(captureState === "capturing" || captureState === "streaming") && (
							<button
								onClick={stopCapture}
								className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
							>
								Stop Capture
							</button>
						)}
					</div>
				</div>

				{/* Video Preview */}
				<div className="bg-gray-800 rounded-lg overflow-hidden">
					<div className="aspect-video bg-black flex items-center justify-center">
						{captureState === "ready" ? (
							<div className="text-center text-gray-500">
								<div className="text-6xl mb-4">🖥️</div>
								<p>Click &quot;Start Capture&quot; to select a window</p>
								<p className="text-sm mt-2">
									Select the emulator window (PCSX2 or Dolphin)
								</p>
							</div>
						) : (
							<video
								ref={videoRef}
								autoPlay
								playsInline
								muted
								className="w-full h-full object-contain"
							/>
						)}
					</div>
				</div>

				{/* Instructions */}
				<div className="mt-6 bg-gray-800 rounded-lg p-4">
					<h2 className="font-bold mb-2">Instructions</h2>
					<ol className="list-decimal list-inside text-gray-400 space-y-1 text-sm">
						<li>
							Make sure your emulator (PCSX2/Dolphin) is running with the game
							loaded
						</li>
						<li>
							Click &quot;Start Capture&quot; and select the emulator window
						</li>
						<li>Connect from your phone to start playing</li>
						<li>Controller inputs from your phone will control the emulator</li>
					</ol>
				</div>

				{/* Debug Info */}
				<div className="mt-4 text-xs text-gray-600">
					Session: {sessionId} | Game: {gameId} | State: {captureState}
				</div>
			</div>
		</div>
	);
}
