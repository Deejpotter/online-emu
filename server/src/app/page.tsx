/**
 * Home Page - Online Emulator Server Dashboard
 *
 * Main entry point showing the game library and server status.
 * Users can browse games, see connection info, and launch games.
 *
 * Profile System:
 * This page requires a profile to be selected (enforced by middleware).
 * Shows the current profile name in the header with option to switch profiles.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GameLibrary, ServerStatus } from "./components";
import type { Game } from "@/types";

interface Profile {
	id: string;
	name: string;
	avatar?: string;
	createdAt: string;
}

export default function Home() {
	const router = useRouter();
	const [profile, setProfile] = useState<Profile | null>(null);

	// Load current profile from cookie on mount
	useEffect(() => {
		const profileId = document.cookie
			.split("; ")
			.find((row) => row.startsWith("profileId="))
			?.split("=")[1];

		if (profileId) {
			// Fetch profile details
			fetch(`/api/profiles/${profileId}`)
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => setProfile(data))
				.catch(() => setProfile(null));
		}
	}, []);

	const handleSelectGame = (game: Game) => {
		// Route to EmulatorJS player page
		router.push(`/play?id=${game.id}`);
	};

	const handleSwitchProfile = () => {
		// Clear profile cookie and redirect to profile selection
		document.cookie =
			"profileId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
		router.push("/profiles");
	};

	return (
		<div className="min-h-screen bg-linear-to-b from-zinc-900 to-zinc-950">
			{/* Header */}
			<header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="text-3xl">🎮</span>
						<div>
							<h1 className="text-xl font-bold">Online Emulator</h1>
							<p className="text-xs text-zinc-500">Remote Play Server</p>
						</div>
					</div>

					{/* User Profile & Actions */}
					<div className="flex items-center gap-4">
						<div className="hidden sm:flex items-center gap-2 text-sm text-zinc-400">
							<span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
							Online
						</div>

						{/* Settings Link */}
						<a
							href="/settings"
							className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors"
							title="Settings"
						>
							⚙️
						</a>

						{profile && (
							<div className="flex items-center gap-3">
								<div className="flex items-center gap-2">
									<span className="text-2xl">{profile.avatar || "👤"}</span>
									<span className="text-sm text-zinc-400 hidden sm:block">
										{profile.name}
									</span>
								</div>
								<button
									onClick={handleSwitchProfile}
									className="text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
								>
									Switch
								</button>
							</div>
						)}
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
					{/* Sidebar - Server Status */}
					<aside className="lg:col-span-1 order-2 lg:order-1">
						<div className="sticky top-24 space-y-6">
							<ServerStatus />

							{/* Quick Help */}
							<div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-800">
								<h4 className="font-medium mb-2 text-sm">Quick Start</h4>
								<ul className="text-xs text-zinc-400 space-y-2">
									<li className="flex items-start gap-2">
										<span>1️⃣</span>
										<span>
											Add ROM files to{" "}
											<code className="bg-zinc-800 px-1 rounded">
												public/roms/
											</code>
										</span>
									</li>
									<li className="flex items-start gap-2">
										<span>2️⃣</span>
										<span>Click &quot;Scan for ROMs&quot; to detect games</span>
									</li>
									<li className="flex items-start gap-2">
										<span>3️⃣</span>
										<span>Connect your phone via the mobile app</span>
									</li>
									<li className="flex items-start gap-2">
										<span>4️⃣</span>
										<span>Select a game and start playing!</span>
									</li>
								</ul>
							</div>

							{/* Supported Systems */}
							<div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-800">
								<h4 className="font-medium mb-2 text-sm">Supported Systems</h4>
								<div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
									<span>• NES / Famicom</span>
									<span>• SNES</span>
									<span>• Game Boy</span>
									<span>• GBA</span>
									<span>• N64</span>
									<span>• Nintendo DS</span>
									<span>• Sega Genesis</span>
									<span>• PlayStation</span>
									<span>• PSP</span>
									<span>• Arcade</span>
								</div>
							</div>
						</div>
					</aside>

					{/* Main - Game Library */}
					<section className="lg:col-span-3 order-1 lg:order-2">
						<GameLibrary onSelectGame={handleSelectGame} />
					</section>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t border-zinc-800 py-6 mt-12">
				<div className="container mx-auto px-4 text-center text-xs text-zinc-500">
					<p>Online Emulator • Self-hosted retro gaming</p>
					<p className="mt-1">
						ROMs must be legally obtained. This software does not include any
						copyrighted games.
					</p>
				</div>
			</footer>
		</div>
	);
}
