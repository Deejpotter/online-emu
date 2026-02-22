/**
 * Emulator Page
 *
 * Renders the EmulatorJS player for the selected game.
 * Wraps EmulatorContent in Suspense to handle useSearchParams properly.
 */

import { Suspense } from "react";
import { EmulatorContent } from "./EmulatorContent";

/**
 * Loading fallback for Suspense boundary.
 */
function EmulatorLoading() {
	return (
		<div className="min-h-screen bg-zinc-950 flex items-center justify-center">
			<div className="text-center">
				<div className="text-6xl mb-4 animate-pulse">🎮</div>
				<p className="text-zinc-400">Loading emulator...</p>
			</div>
		</div>
	);
}

export default function EmulatorPage() {
	return (
		<Suspense fallback={<EmulatorLoading />}>
			<EmulatorContent />
		</Suspense>
	);
}
