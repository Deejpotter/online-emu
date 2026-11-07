/**
 * Root Layout
 *
 * Sets up the app shell with:
 * - Profile context (ProfileProvider) for user identification
 * - PWA support (viewport meta tags, theme color, service worker)
 *
 * User Profiles:
 * Users select a profile on first visit (like Netflix/Plex).
 * Profiles are just names - no passwords required.
 * Profile ID is used to separate save files between users.
 *
 * PWA Installation:
 * Users can install this web app on their devices via:
 * - Chrome: Menu > "Install Online Emulator"
 * - Safari iOS: Share > "Add to Home Screen"
 * - Edge: Menu > Apps > "Install this site as an app"
 */

import type { Metadata, Viewport } from "next";
// Bundled font files (no Google Fonts fetch at build time, so a network blip can't fail a deploy)
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ToastProvider } from "@/app/components";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

const APP_NAME = "Online Emulator";
const DESCRIPTION = "Self-hosted game console emulator with mobile streaming support";

export const metadata: Metadata = {
	metadataBase: new URL("https://roms.deejpotter.com"),
	title: APP_NAME,
	description: DESCRIPTION,
	applicationName: APP_NAME,
	keywords: ["emulator", "gaming", "retro", "streaming", "remote play", "pwa"],
	// Private app: keep it out of search engines.
	robots: { index: false, follow: false },
	// Icons come from the file conventions in src/app (icon.svg, favicon.ico, apple-icon.png).
	// Next.js generates manifest at /manifest.webmanifest via src/app/manifest.ts
	manifest: "/manifest.webmanifest",
	openGraph: {
		type: "website",
		siteName: APP_NAME,
		title: APP_NAME,
		description: DESCRIPTION,
		images: [{ url: "/icon-512x512.png", width: 512, height: 512, alt: APP_NAME }],
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "OnlineEmu",
	},
	formatDetection: {
		telephone: false,
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false, // Prevent zoom on mobile for better game controls
	viewportFit: "cover", // Support for notched devices
	// The app is dark in both colour schemes, so both use zinc-900.
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#18181b" },
		{ media: "(prefers-color-scheme: dark)", color: "#18181b" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				{/* iOS PWA specific (appleWebApp emits the title and status bar style) */}
				<meta name="apple-mobile-web-app-capable" content="yes" />

				{/* Windows PWA */}
				<meta name="msapplication-TileColor" content="#18181b" />
				<meta name="msapplication-TileImage" content="/icon-192x192.png" />
			</head>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}
			>
				<ToastProvider>
					{children}
				</ToastProvider>

				{/* Service Worker Registration */}
				<script
					dangerouslySetInnerHTML={{
						__html: `
							if ('serviceWorker' in navigator) {
								window.addEventListener('load', function() {
									navigator.serviceWorker.register('/sw.js', { scope: '/' })
										.then(function(registration) {
											console.log('[PWA] Service worker registered:', registration.scope);
										})
										.catch(function(error) {
											console.log('[PWA] Service worker registration failed:', error);
										});
								});
							}
						`,
					}}
				/>
			</body>
		</html>
	);
}
