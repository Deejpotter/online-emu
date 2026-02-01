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
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/app/components";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Online Emulator",
	description:
		"Self-hosted game console emulator with mobile streaming support",
	keywords: ["emulator", "gaming", "retro", "streaming", "remote play", "pwa"],
	// PWA specific metadata
	// Next.js generates manifest at /manifest.json (not .webmanifest)
	manifest: "/manifest.json",
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
	themeColor: "#18181b", // zinc-900
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				{/* PWA Icons */}
				<link rel="icon" href="/icon-192x192.png" sizes="192x192" />
				<link rel="apple-touch-icon" href="/icon-192x192.png" />

				{/* iOS PWA specific */}
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta
					name="apple-mobile-web-app-status-bar-style"
					content="black-translucent"
				/>
				<meta name="apple-mobile-web-app-title" content="OnlineEmu" />

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
