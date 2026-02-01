/**
 * Sunshine Streaming Page
 *
 * Streams PS2/GameCube games via Sunshine + moonlight-web-stream.
 * This page:
 * 1. Launches the game via Sunshine API
 * 2. Embeds moonlight-web-stream player in an iframe
 * 3. Provides fullscreen controls and back navigation
 */

import { Suspense } from "react";
import { StreamContent } from "./StreamContent";

interface StreamPageProps {
	params: Promise<{ gameId: string }>;
}

/**
 * Loading fallback for Suspense boundary.
 */
function StreamLoading() {
	return (
		<div className="min-h-screen bg-zinc-950 flex items-center justify-center">
			<div className="text-center">
				<div className="text-6xl mb-4 animate-pulse">📡</div>
				<p className="text-zinc-400">Connecting to stream...</p>
			</div>
		</div>
	);
}

export default async function StreamPage({ params }: StreamPageProps) {
	const { gameId } = await params;

	return (
		<Suspense fallback={<StreamLoading />}>
			<StreamContent gameId={gameId} />
		</Suspense>
	);
}
