/**
 * PWA Web App Manifest
 *
 * Defines metadata for installing the web app on mobile/desktop devices.
 * Users can "Add to Home Screen" to get an app-like experience.
 *
 * This replaces the need for a separate mobile app (Expo).
 * The PWA provides:
 * - Home screen/start menu installation
 * - Standalone display mode (no browser chrome)
 * - Proper app icons and splash screens
 * - Offline capability (with service worker)
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		id: "/", // Unique identifier for the PWA
		name: "Online Emulator",
		short_name: "OnlineEmu",
		description:
			"Self-hosted game console emulator with mobile streaming support. Play retro games on any device.",
		start_url: "/",
		display: "standalone", // Hide browser UI for app-like feel
		orientation: "any", // Support both portrait and landscape
		background_color: "#09090b", // zinc-950
		theme_color: "#18181b", // zinc-900
		categories: ["games", "entertainment"],
		icons: [
			{
				src: "/icon-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
		],
		// Screenshots for app store listings (optional)
		screenshots: [
			{
				src: "/screenshot-game-library.png",
				sizes: "1280x720",
				type: "image/png",
				label: "Game Library",
			},
			{
				src: "/screenshot-gameplay.png",
				sizes: "1280x720",
				type: "image/png",
				label: "Gameplay",
			},
		],
		// Shortcuts for quick actions from home screen icon
		shortcuts: [
			{
				name: "Game Library",
				short_name: "Library",
				description: "Browse your game collection",
				url: "/",
				icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
			},
		],
	};
}
