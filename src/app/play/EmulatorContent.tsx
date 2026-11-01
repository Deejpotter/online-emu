/**
 * Emulator Page Content â€” DESIGN RATIONALE
 *
 * Purpose: host EmulatorJS in a safe, isolated environment while keeping a
 * React-based UI for library, controls and save management.
 *
 * Why an iframe (not embedding directly):
 * - EmulatorJS directly manipulates the DOM and uses WebAssembly cores that
 *   assume sole control of their canvas and runtime. Embedding it directly
 *   in React breaks reconciliation and causes subtle runtime bugs.
 * - Isolation via an iframe preserves React's virtual DOM invariants while
 *   allowing the emulator to run at native speed in-browser.
 *
 * Communication pattern (robust and explicit):
 * - `postMessage` used for all parentâ†”iframe interactions to avoid coupling.
 * - Messages are small, event-driven and authoritative (e.g. emulator "save"
 *   events trigger immediate server uploads). This avoids polling and race
 *   conditions.
 *
 * UX choices explained:
 * - Event-driven saves: SRM and manual save-states are uploaded immediately on
 *   emulator events. This gives deterministic feedback to users and removes
 *   the uncertainty associated with periodic polling.
 * - Joystick-first input mapping: left-analog mapped to Dâ€‘pad by default to
 *   support common controllers where Dâ€‘pad may be unreliable â€” improves UX
 *   across real devices.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Game, EmulatorSystem } from "@/types";
import { useToast } from "@/app/components";

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
	type: "saveState" | "loadState" | "pause" | "resume" | "getCanvas" | "flushSave";
	/** Save slot for saveState/loadState; 0 is the automatic slot */
	slot?: number;
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
	| { type: "stateSaved"; slot?: number }
	| { type: "stateLoaded"; slot?: number }
	| { type: "stateLoadFailed"; slot?: number; reason?: "empty" | "error" }
	| { type: "srmSaveStarted" }
	| { type: "srmSaveComplete"; success?: boolean }
	| { type: "serverSaveComplete"; success?: boolean }
	| { type: "autoSaveDisabled"; kind?: "state" | "srm" }
	| { type: "flushSaveComplete"; state?: boolean; srm?: boolean }
	| { type: "canvasInfo"; width: number; height: number };

/**
 * Map our system IDs to EmulatorJS core names.
 *
 * These are the core identifiers that EmulatorJS expects.
 * EmulatorJS uses libretro cores compiled to WebAssembly.
 */
const SYSTEM_TO_CORE: Record<EmulatorSystem, string> = {
	nes: "nes",
	snes: "snes",
	gb: "gb",
	gba: "gba",
	n64: "n64",
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

/** Manual save slots; slot 0 is reserved for the automatic save */
const SAVE_SLOTS = [1, 2, 3] as const;
const SLOT_KEY = "online-emu:save-slot";

/** Consecutive failed server saves before the player is warned */
const SAVE_FAILURE_WARN_AT = 2;

/** How long the Back button waits for the leaving save before navigating anyway */
const LEAVE_SAVE_TIMEOUT_MS = 4000;

export function EmulatorContent() {
	const searchParams = useSearchParams();
	const { showToast } = useToast();
	const [game, setGame] = useState<Game | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [emulatorState, setEmulatorState] = useState<
		"loading" | "ready" | "playing" | "paused"
	>("loading");
	const [showControls, setShowControls] = useState(true);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const saveFailuresRef = useRef(0);
	const autoSaveWarnedRef = useRef(false);
	const leaveResolverRef = useRef<(() => void) | null>(null);
	const [leaving, setLeaving] = useState(false);
	const [saveSlot, setSaveSlot] = useState<number>(SAVE_SLOTS[0]);

	// Remember the chosen slot across games; storage may be unavailable
	useEffect(() => {
		try {
			const saved = Number(localStorage.getItem(SLOT_KEY));
			if ((SAVE_SLOTS as readonly number[]).includes(saved)) setSaveSlot(saved);
		} catch {
			// ignore
		}
	}, []);
	const chooseSlot = useCallback((slot: number) => {
		setSaveSlot(slot);
		try {
			localStorage.setItem(SLOT_KEY, String(slot));
		} catch {
			// ignore
		}
	}, []);

	// Get game ID from URL params
	const gameId = searchParams.get("id");

	/**
	 * Send a message to the emulator iframe
	 */
	const sendToEmulator = useCallback((message: EmulatorOutgoingMessage) => {
		if (iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.postMessage(message, window.location.origin);
		}
	}, []);

	/**
	 * Handle messages from the emulator iframe
	 */
	const handleEmulatorMessage = useCallback(
		(event: MessageEvent<EmulatorIncomingMessage>) => {
			// Only trust our own emulator iframe (same origin)
			if (event.origin !== window.location.origin) {
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

				case "stateSaved": {
					const slot = (data as { slot?: number }).slot;
					console.log("[Emulator] State saved", slot);
					showToast(slot ? `Saved to slot ${slot}` : "Game saved!", "success");
					break;
				}

				case "stateLoaded": {
					const slot = (data as { slot?: number }).slot;
					console.log("[Emulator] State loaded", slot);
					showToast(slot ? `Loaded slot ${slot}` : "Game loaded!", "success");
					break;
				}

				case "stateLoadFailed": {
					const { slot, reason } = data as { slot?: number; reason?: string };
					showToast(
						reason === "empty" ? `Slot ${slot ?? 0} is empty` : `Couldn't load slot ${slot ?? 0}`,
						reason === "empty" ? "info" : "error"
					);
					break;
				}

				case "srmSaveComplete":
					console.log("[Emulator] SRM save complete", data);
					if ((data as { success?: boolean } | undefined)?.success) {
						showToast("In-game save uploaded to server", "success");
					} else {
						showToast("Failed to upload in-game save", "error");
					}
					break;

				case "serverSaveComplete":
					// Warn once after repeated failures; a success resets the count
					if ((data as { success?: boolean }).success) {
						saveFailuresRef.current = 0;
					} else {
						saveFailuresRef.current += 1;
						if (saveFailuresRef.current === SAVE_FAILURE_WARN_AT) {
							showToast("Saving to the server keeps failing. Check your connection.", "error");
						}
					}
					break;

				case "autoSaveDisabled":
					if (!autoSaveWarnedRef.current) {
						autoSaveWarnedRef.current = true;
						showToast(
							"Couldn't restore your save from the server, so automatic saving is off for this session.",
							"error"
						);
					}
					break;

				case "flushSaveComplete":
					leaveResolverRef.current?.();
					break;

				case "srmSaveStarted":
					// ephemeral indicator that the iframe has started uploading SRM
					console.log("[Emulator] SRM save started", data);
					showToast("Saving in-game save...", "info");
					break;
			}
		},
		[game, showToast]
	);

	/**
	 * Back to the library: ask the emulator to save first (through its save
	 * guard), then do a full page load. Navigates anyway after a timeout.
	 */
	const handleBack = useCallback(
		(event: React.MouseEvent<HTMLAnchorElement>) => {
			if (emulatorState !== "playing" && emulatorState !== "paused") return;
			event.preventDefault();
			if (leaving) return;
			setLeaving(true);

			const href = event.currentTarget.href;
			const done = new Promise<void>((resolve) => {
				leaveResolverRef.current = resolve;
				setTimeout(resolve, LEAVE_SAVE_TIMEOUT_MS);
			});
			sendToEmulator({ type: "flushSave" });
			done.then(() => {
				leaveResolverRef.current = null;
				window.location.assign(href);
			});
		},
		[emulatorState, leaving, sendToEmulator]
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
	 * autoStart defaults to true - games start immediately when user clicks play.
	 * This satisfies browser autoplay policies which require user gestures.
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
					<div className="text-6xl mb-4">âŒ</div>
					<h1 className="text-xl font-bold mb-2">Failed to load game</h1>
					<p className="text-zinc-400 mb-6">{error || "Unknown error"}</p>
					{/* Full page load on purpose: tears down EmulatorJS globals and audio. */}
					{/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
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
						{/* Full page load on purpose: tears down EmulatorJS globals and audio. */}
						{/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
						<a
							href="/"
							onClick={handleBack}
							aria-busy={leaving}
							className="text-zinc-400 hover:text-white transition-colors shrink-0 text-sm md:text-base"
						>
							{leaving ? "Saving..." : "← Back"}
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
								<select
									aria-label="Save slot"
									value={saveSlot}
									onChange={(e) => chooseSlot(Number(e.target.value))}
									className="px-2 py-2 text-xs md:text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg min-h-[44px]"
								>
									{SAVE_SLOTS.map((slot) => (
										<option key={slot} value={slot}>
											Slot {slot}
										</option>
									))}
								</select>
								<button
									onClick={() => sendToEmulator({ type: "saveState", slot: saveSlot })}
									className="px-3 py-2 text-xs md:text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors min-h-[44px]"
								>
									💾 Save
								</button>
								<button
									onClick={() => sendToEmulator({ type: "loadState", slot: saveSlot })}
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
							aria-label={showControls ? "Hide controls" : "Show controls"}
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

