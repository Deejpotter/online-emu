/**
 * Streaming Page
 *
 * This page runs EmulatorJS and streams it via WebRTC to connected phones.
 * It acts as the "streaming source" - the phone just receives and displays the video.
 *
 * Flow:
 * 1. Page loads with sessionId and gameId params
 * 2. EmulatorJS starts and renders game to canvas
 * 3. Canvas is captured as MediaStream
 * 4. WebRTC peer connection sends video to phone
 * 5. Phone sends controller inputs back via Socket.IO
 * 6. Inputs are injected into EmulatorJS
 */

import { Suspense } from "react";
import StreamContent from "./StreamContent";

/**
 * Loading fallback shown while the streaming page initializes.
 */
function StreamingLoading() {
	return (
		<div className="min-h-screen bg-black flex items-center justify-center">
			<div className="text-center">
				<div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4" />
				<p className="text-white text-lg">Initializing stream...</p>
			</div>
		</div>
	);
}

/**
 * Streaming page wrapper with Suspense boundary.
 * The actual content uses useSearchParams which requires Suspense.
 */
export default function StreamPage() {
	return (
		<Suspense fallback={<StreamingLoading />}>
			<StreamContent />
		</Suspense>
	);
}
