"use client";

/**
 * Stream Content Component
 *
 * Client component that handles launching games via Sunshine
 * and embedding the moonlight-web-stream player.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface StreamContentProps {
	gameId: string;
}

interface LaunchResponse {
	success: boolean;
	streamUrl?: string;
	appName?: string;
	error?: string;
}

type StreamState =
	| "launching"
	| "connecting"
	| "streaming"
	| "error"
	| "not-configured";

export function StreamContent({ gameId }: StreamContentProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const [state, setState] = useState<StreamState>("launching");
	const [error, setError] = useState<string | null>(null);
	const [streamUrl, setStreamUrl] = useState<string | null>(null);
	const [appName, setAppName] = useState<string | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showControls, setShowControls] = useState(true);

	// Launch the game via Sunshine API
	const launchGame = useCallback(async () => {
		setState("launching");
		setError(null);

		try {
			const response = await fetch("/api/sunshine/launch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ gameId }),
			});

			const data: LaunchResponse = await response.json();

			if (!data.success) {
				if (
					data.error?.includes("not configured") ||
					data.error?.includes("not running")
				) {
					setState("not-configured");
				} else {
					setState("error");
				}
				setError(data.error || "Failed to launch game");
				return;
			}

			setStreamUrl(data.streamUrl || null);
			setAppName(data.appName || null);
			setState("connecting");
		} catch (err) {
			setState("error");
			setError(
				err instanceof Error ? err.message : "Failed to launch game"
			);
		}
	}, [gameId]);

	// Launch game on mount
	useEffect(() => {
		launchGame();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Handle fullscreen
	const toggleFullscreen = useCallback(() => {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
			setIsFullscreen(true);
		} else {
			document.exitFullscreen();
			setIsFullscreen(false);
		}
	}, []);

	// Listen for fullscreen changes
	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(Boolean(document.fullscreenElement));
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener(
				"fullscreenchange",
				handleFullscreenChange
			);
		};
	}, []);

	// Auto-hide controls after 3 seconds
	useEffect(() => {
		if (state !== "streaming") return;

		let timeout: NodeJS.Timeout;
		const hideControls = () => {
			timeout = setTimeout(() => setShowControls(false), 3000);
		};

		const showControlsHandler = () => {
			setShowControls(true);
			clearTimeout(timeout);
			hideControls();
		};

		document.addEventListener("mousemove", showControlsHandler);
		document.addEventListener("touchstart", showControlsHandler);
		hideControls();

		return () => {
			clearTimeout(timeout);
			document.removeEventListener("mousemove", showControlsHandler);
			document.removeEventListener("touchstart", showControlsHandler);
		};
	}, [state]);

	// Handle iframe load
	const handleIframeLoad = () => {
		setState("streaming");
	};

	// Render based on state
	if (state === "not-configured") {
		return (
			<div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
				<div className="max-w-md text-center">
					<div className="text-6xl mb-4">⚙️</div>
					<h1 className="text-2xl font-bold text-white mb-4">
						Sunshine Not Configured
					</h1>
					<p className="text-zinc-400 mb-6">
						PS2 and GameCube games require Sunshine and
						moonlight-web-stream to be installed and configured.
					</p>
					<div className="space-y-3">
						<Link
							href="/settings"
							className="block w-full px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition"
						>
							Configure Sunshine
						</Link>
						<Link
							href="/"
							className="block w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition"
						>
							Back to Library
						</Link>
					</div>
					{error && (
						<p className="mt-4 text-sm text-red-400">{error}</p>
					)}
				</div>
			</div>
		);
	}

	if (state === "error") {
		return (
			<div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
				<div className="max-w-md text-center">
					<div className="text-6xl mb-4">❌</div>
					<h1 className="text-2xl font-bold text-white mb-4">
						Stream Error
					</h1>
					<p className="text-zinc-400 mb-6">{error}</p>
					<div className="space-y-3">
						<button
							onClick={launchGame}
							className="block w-full px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition"
						>
							Try Again
						</button>
						<Link
							href="/"
							className="block w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition"
						>
							Back to Library
						</Link>
					</div>
				</div>
			</div>
		);
	}

	if (state === "launching") {
		return (
			<div className="min-h-screen bg-zinc-950 flex items-center justify-center">
				<div className="text-center">
					<div className="text-6xl mb-4 animate-bounce">🚀</div>
					<p className="text-zinc-400 text-lg">Launching game...</p>
					<p className="text-zinc-500 text-sm mt-2">
						Starting emulator and connecting to Sunshine
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="relative w-screen h-screen bg-black overflow-hidden">
			{/* Stream iframe */}
			{streamUrl && (
				<iframe
					ref={iframeRef}
					src={streamUrl}
					className="absolute inset-0 w-full h-full border-0"
					allow="autoplay; fullscreen; gamepad"
					onLoad={handleIframeLoad}
				/>
			)}

			{/* Loading overlay */}
			{state === "connecting" && (
				<div className="absolute inset-0 bg-zinc-950 flex items-center justify-center z-10">
					<div className="text-center">
						<div className="text-6xl mb-4 animate-pulse">📡</div>
						<p className="text-zinc-400 text-lg">
							Connecting to stream...
						</p>
						<p className="text-zinc-500 text-sm mt-2">
							{appName && `Starting ${appName}`}
						</p>
						<p className="text-zinc-600 text-xs mt-4">
							Make sure moonlight-web-stream is running and paired
							with Sunshine
						</p>
					</div>
				</div>
			)}

			{/* Controls overlay */}
			{state === "streaming" && showControls && (
				<div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-20 transition-opacity">
					<div className="flex items-center justify-between">
						<Link
							href="/"
							className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-lg transition backdrop-blur"
						>
							<span>←</span>
							<span>Back</span>
						</Link>

						<div className="flex items-center gap-2">
							{appName && (
								<span className="text-white/70 text-sm mr-4">
									{appName}
								</span>
							)}
							<button
								onClick={toggleFullscreen}
								className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-lg transition backdrop-blur"
							>
								{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
