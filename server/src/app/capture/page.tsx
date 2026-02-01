/**
 * Screen Capture Page
 *
 * Used for external emulators (PS2/GameCube).
 * This page captures any window using getDisplayMedia and streams it via WebRTC.
 *
 * Usage: /capture?session={sessionId}&game={gameId}
 */

import { Suspense } from "react";
import CaptureContent from "./CaptureContent";

export default function CapturePage() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
					<p className="text-xl">Loading...</p>
				</div>
			}
		>
			<CaptureContent />
		</Suspense>
	);
}
