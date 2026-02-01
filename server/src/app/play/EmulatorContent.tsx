/**
 * Emulator Page Content
 *
 * Hosts EmulatorJS in an iframe to isolate it from React's DOM.
 * This is REQUIRED because EmulatorJS manipulates the DOM directly,
 * which conflicts with React's virtual DOM.
 *
 * For external systems (PS2, GameCube), shows a launch UI that
 * starts the external emulator on the PC.
 *
 * From EmulatorJS docs:
 * "To embed within React or a SPA, the only way is to embed an iframe
 *  into your page. You cannot run it directly on the page."
 *
 * Communication with the iframe happens via postMessage API.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Game, EmulatorSystem } from "@/types";
import { isExternalSystem } from "@/types";

/**
 * Message types sent TO the emulator iframe
 */
interface EmulatorInputMessage {
	type: "input";
	button: string;
	pressed: boolean;
}

interface EmulatorAnalogMessage {
	type: "analog";
	stick: "left" | "right";
	x: number;
	y: number;
}

interface EmulatorControlMessage {
	type: "saveState" | "loadState" | "pause" | "resume" | "getCanvas";
}

interface EmulatorVolumeMessage {
	type: "setVolume";
	volume: number;
}

type EmulatorOutgoingMessage =
	| EmulatorInputMessage
	| EmulatorAnalogMessage
	| EmulatorControlMessage
	| EmulatorVolumeMessage;

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
	state: "playing" | "paused" | "loading" | "ready";
}

type EmulatorIncomingMessage =
	| EmulatorReadyMessage
	| EmulatorErrorMessage
	| EmulatorStateMessage
	| { type: "stateSaved" }
	| { type: "stateLoaded" }
	| { type: "canvasInfo"; width: number; height: number };

/**
 * Map our system IDs to EmulatorJS core names.
 * External systems (ps2, gamecube) are included for type completeness
 * but won't be used in this component (they use external emulators).
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
 * Keyboard to button mapping for local play
 */
const KEYBOARD_MAP: Record<string, string> = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
	KeyZ: "a",
	KeyX: "b",
	KeyA: "x",
	KeyS: "y",
	KeyQ: "l",
	KeyW: "r",
	Enter: "start",
	ShiftRight: "select",
	ShiftLeft: "select",
	Space: "a", // Alternative for A button
};

export function EmulatorContent() {
	const searchParams = useSearchParams();
	const [game, setGame] = useState<Game | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [emulatorState, setEmulatorState] = useState<
		"loading" | "ready" | "playing" | "paused"
	>("loading");
	const [showControls, setShowControls] = useState(true);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// External emulator states
	const [externalLaunching, setExternalLaunching] = useState(false);
	const [externalRunning, setExternalRunning] = useState(false);
	const [externalError, setExternalError] = useState<string | null>(null);

	// Get game ID from URL params
	const gameId = searchParams.get("id");

	/**
	 * Send a message to the emulator iframe
	 */
	const sendToEmulator = useCallback((message: EmulatorOutgoingMessage) => {
		if (iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.postMessage(message, "*");
		}
	}, []);

	/**
	 * Handle messages from the emulator iframe
	 */
	const handleEmulatorMessage = useCallback(
		(event: MessageEvent<EmulatorIncomingMessage>) => {
			// Basic origin check (in production, be more specific)
			if (!event.origin.includes(window.location.host)) {
				return;
			}

			const data = event.data;
			if (!data || typeof data.type !== "string") return;

			switch (data.type) {
				case "ready":
					console.log("[Emulator] Ready:", data.width, "x", data.height);
					setEmulatorState("playing");

					// Mark game as played
					if (game) {
						fetch(`/api/games/${game.id}`, {
							method: "PATCH",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ action: "play" }),
						}).catch(console.error);
					}
					break;

				case "error":
					console.error("[Emulator] Error:", data.message);
					setError(data.message);
					break;

				case "stateChanged":
					console.log("[Emulator] State:", data.state);
					// Map 'ready' to 'playing' for our UI purposes
					if (data.state === "ready") {
						setEmulatorState("playing");
					} else if (data.state === "playing" || data.state === "paused") {
						setEmulatorState(data.state);
					}
					break;

				case "stateSaved":
					console.log("[Emulator] State saved");
					break;

				case "stateLoaded":
					console.log("[Emulator] State loaded");
					break;
			}
		},
		[game]
	);

	/**
	 * Handle keyboard input and forward to emulator
	 */
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			const button = KEYBOARD_MAP[event.code];
			if (button) {
				event.preventDefault();
				sendToEmulator({ type: "input", button, pressed: true });
			}
		},
		[sendToEmulator]
	);

	const handleKeyUp = useCallback(
		(event: KeyboardEvent) => {
			const button = KEYBOARD_MAP[event.code];
			if (button) {
				event.preventDefault();
				sendToEmulator({ type: "input", button, pressed: false });
			}
		},
		[sendToEmulator]
	);

	// Fetch game data on mount
	useEffect(() => {
		if (!gameId) {
			setError("No game ID provided");
			setLoading(false);
			return;
		}

		async function fetchGame() {
			try {
				const response = await fetch(`/api/games/${gameId}`);
				const result = await response.json();

				if (result.success) {
					setGame(result.data.game);
				} else {
					setError(result.error || "Failed to load game");
				}
			} catch (err) {
				setError("Failed to fetch game data");
				console.error("[Emulator] Fetch error:", err);
			} finally {
				setLoading(false);
			}
		}

		fetchGame();
	}, [gameId]);

	// Set up message listener and keyboard handlers
	useEffect(() => {
		window.addEventListener("message", handleEmulatorMessage);
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("message", handleEmulatorMessage);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [handleEmulatorMessage, handleKeyDown, handleKeyUp]);

	/**
	 * Toggle fullscreen mode for the emulator container
	 */
	const toggleFullscreen = useCallback(async () => {
		if (!containerRef.current) return;

		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await containerRef.current.requestFullscreen();
			}
		} catch (err) {
			console.error("[Emulator] Fullscreen error:", err);
		}
	}, []);

	/**
	 * Build the iframe URL with game parameters.
	 *
	 * autoStart defaults to true - games start immediately.
	 * Set autoStart=false in URL to disable (e.g., for debugging).
	 */
	const getEmulatorUrl = useCallback(() => {
		if (!game) return "";

		// Convert Windows backslashes to forward slashes, then URL-encode each segment
		// romPath may contain Windows-style paths like "N64\ROMs\game.z64"
		const normalizedPath = game.romPath.replace(/\\/g, "/");
		const encodedRomPath = normalizedPath
			.split("/")
			.map((segment) => encodeURIComponent(segment))
			.join("/");

		// Auto-start is ON by default - only disable if explicitly set to false
		const autoStart = searchParams.get("autoStart") !== "false";

		const params = new URLSearchParams({
			gameUrl: `/api/roms/${encodedRomPath}`,
			core: SYSTEM_TO_CORE[game.system] || game.system,
			system: game.system,
			autoStart: autoStart ? "true" : "false",
		});

		console.log(
			"[Emulator] ROM path:",
			game.romPath,
			"->",
			`/api/roms/${encodedRomPath}`
		);

		return `/emulator.html?${params.toString()}`;
	}, [game, searchParams]);

	/**
	 * Launch an external emulator (PS2, GameCube)
	 */
	const launchExternalEmulator = useCallback(async () => {
		if (!game) return;

		setExternalLaunching(true);
		setExternalError(null);

		try {
			const response = await fetch("/api/launch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ gameId: game.id }),
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || "Failed to launch emulator");
			}

			setExternalRunning(true);
		} catch (err) {
			setExternalError(err instanceof Error ? err.message : "Failed to launch");
		} finally {
			setExternalLaunching(false);
		}
	}, [game]);

	/**
	 * Stop the external emulator
	 */
	const stopExternalEmulator = useCallback(async () => {
		try {
			await fetch("/api/launch", { method: "DELETE" });
			setExternalRunning(false);
		} catch (err) {
			console.error("[Emulator] Failed to stop external emulator:", err);
		}
	}, []);

	// Loading state
	if (loading) {
		return (
			<div className="min-h-screen bg-zinc-950 flex items-center justify-center">
				<div className="text-center">
					<div className="text-6xl mb-4 animate-pulse">🎮</div>
					<p className="text-zinc-400">Loading emulator...</p>
				</div>
			</div>
		);
	}

	// Error state
	if (error || !game) {
		return (
			<div className="min-h-screen bg-zinc-950 flex items-center justify-center">
				<div className="text-center max-w-md">
					<div className="text-6xl mb-4">❌</div>
					<h1 className="text-xl font-bold mb-2">Failed to load game</h1>
					<p className="text-zinc-400 mb-6">{error || "Unknown error"}</p>
					<a
						href="/"
						className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
					>
						← Back to Library
					</a>
				</div>
			</div>
		);
	}

	// External emulator (PS2, GameCube) - show launch UI instead of iframe
	if (isExternalSystem(game.system)) {
		const emulatorName = game.system === "ps2" ? "PCSX2" : "Dolphin";

		return (
			<div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8">
				<div className="text-center max-w-lg">
					{/* Game Info */}
					<div className="text-6xl mb-4">
						{game.system === "ps2" ? "🎮" : "🎲"}
					</div>
					<h1 className="text-2xl font-bold mb-2">{game.title}</h1>
					<p className="text-zinc-400 mb-6">
						{game.system.toUpperCase()} • Requires {emulatorName}
					</p>

					{/* External Error */}
					{externalError && (
						<div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
							<p className="text-red-300 text-sm">{externalError}</p>
							<p className="text-red-400/70 text-xs mt-2">
								Make sure {emulatorName} is installed and configured in{" "}
								<a href="/settings" className="underline hover:text-red-300">
									Settings
								</a>
							</p>
						</div>
					)}

					{/* Launch/Running State */}
					{externalRunning ? (
						<div className="space-y-4">
							<div className="p-6 bg-green-900/20 border border-green-500/30 rounded-lg">
								<div className="text-4xl mb-2 animate-pulse">▶️</div>
								<p className="text-green-400">
									{emulatorName} is running on your PC
								</p>
								<p className="text-zinc-500 text-sm mt-2">
									The game window should be open on your computer
								</p>
							</div>

							<button
								onClick={stopExternalEmulator}
								className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors"
							>
								Stop {emulatorName}
							</button>
						</div>
					) : (
						<div className="space-y-4">
							<button
								onClick={launchExternalEmulator}
								disabled={externalLaunching}
								className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 
									rounded-lg font-medium text-lg transition-colors w-full"
							>
								{externalLaunching ? (
									<>
										<span className="animate-pulse">Launching...</span>
									</>
								) : (
									<>Launch in {emulatorName}</>
								)}
							</button>

							<p className="text-zinc-500 text-sm">
								This will open {emulatorName} on your PC with this game loaded
							</p>
						</div>
					)}

					{/* Navigation */}
					<div className="mt-8 pt-6 border-t border-zinc-800 space-y-3">
						<a
							href="/"
							className="inline-block text-zinc-400 hover:text-white transition-colors"
						>
							← Back to Library
						</a>
						<span className="text-zinc-700 mx-3">|</span>
						<a
							href="/settings"
							className="inline-block text-zinc-400 hover:text-white transition-colors"
						>
							⚙️ Configure {emulatorName}
						</a>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 bg-zinc-950 flex flex-col">
			{/* Collapsible Header - tap to toggle on mobile */}
			<header
				className={`
					border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm
					transition-all duration-300 ease-in-out z-20 shrink-0
					${showControls ? "p-3 md:p-4" : "p-1"}
				`}
			>
				<div className="container mx-auto flex items-center justify-between gap-2">
					{/* Left side - Back + Title */}
					<div className="flex items-center gap-2 md:gap-4 min-w-0">
						<a
							href="/"
							className="text-zinc-400 hover:text-white transition-colors shrink-0 text-sm md:text-base"
						>
							← Back
						</a>
						{showControls && (
							<div className="min-w-0">
								<h1 className="font-bold text-sm md:text-base truncate">
									{game.title}
								</h1>
								<p className="text-xs text-zinc-500">
									{game.system.toUpperCase()}
									{emulatorState === "loading" && " • Loading..."}
									{emulatorState === "paused" && " • Paused"}
								</p>
							</div>
						)}
					</div>

					{/* Right side - Actions */}
					<div className="flex items-center gap-2 md:gap-4 shrink-0">
						{showControls && emulatorState === "playing" && (
							<>
								<button
									onClick={() => sendToEmulator({ type: "saveState" })}
									className="px-3 py-2 text-xs md:text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors min-h-[44px]"
								>
									💾 Save
								</button>
								<button
									onClick={() => sendToEmulator({ type: "loadState" })}
									className="px-3 py-2 text-xs md:text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors min-h-[44px]"
								>
									📂 Load
								</button>
							</>
						)}

						{/* Fullscreen button - always visible, prominent on mobile */}
						<button
							onClick={toggleFullscreen}
							className="px-3 py-2 text-xs md:text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium min-h-[44px]"
							title="Toggle fullscreen"
						>
							⛶ Full
						</button>

						{/* Toggle header visibility on mobile */}
						<button
							onClick={() => setShowControls(!showControls)}
							className="md:hidden px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors min-h-[44px]"
							title={showControls ? "Hide controls" : "Show controls"}
						>
							{showControls ? "▲" : "▼"}
						</button>
					</div>
				</div>

				{/* Keyboard controls hint - only on desktop when expanded */}
				{showControls && (
					<p className="hidden md:block text-center text-xs text-zinc-500 mt-2">
						<strong>Keyboard:</strong> Arrows = D-Pad, Z = A, X = B, A = X, S =
						Y, Q/W = L/R, Enter = Start, Shift = Select
					</p>
				)}
			</header>

			{/* Emulator Container (iframe) - fills remaining space */}
			<main
				ref={containerRef}
				className="flex-1 relative bg-black"
				style={{ minHeight: 0 }}
			>
				{/* Loading overlay - shown while waiting for EmulatorJS */}
				{emulatorState === "loading" && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 pointer-events-none">
						<div className="text-center">
							<div className="text-4xl mb-4 animate-pulse">🎮</div>
							<p className="text-zinc-400">Initializing emulator...</p>
							<p className="text-zinc-500 text-sm mt-2">
								Click the game to start
							</p>
						</div>
					</div>
				)}

				{/* EmulatorJS iframe - fills the container */}
				<iframe
					ref={iframeRef}
					src={getEmulatorUrl()}
					className="absolute inset-0 w-full h-full border-0"
					title={`${game.title} - EmulatorJS`}
					allow="autoplay; gamepad; fullscreen"
					sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
				/>
			</main>
		</div>
	);
}
