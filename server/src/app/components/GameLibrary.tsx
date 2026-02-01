/**
 * GameLibrary Component
 *
 * Main component for browsing and managing the game library.
 * Includes filtering by system and search functionality.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { GameCard } from "./GameCard";
import type { Game, EmulatorSystem } from "@/types";

interface GameLibraryProps {
	onSelectGame: (game: Game) => void;
}

interface SystemInfo {
	id: EmulatorSystem;
	name: string;
	count: number;
}

/**
 * Human-readable system names for display (client-side duplicate).
 */
const SYSTEM_NAMES: Record<EmulatorSystem, string> = {
	nes: "NES",
	snes: "SNES",
	gb: "Game Boy",
	gba: "GBA",
	n64: "N64",
	nds: "DS",
	segaMD: "Genesis",
	segaMS: "Master System",
	segaGG: "Game Gear",
	segaCD: "Sega CD",
	psx: "PlayStation",
	psp: "PSP",
	atari2600: "Atari 2600",
	arcade: "Arcade",
	// External systems
	ps2: "PS2",
	gamecube: "GameCube",
};

export function GameLibrary({ onSelectGame }: GameLibraryProps) {
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedSystem, setSelectedSystem] = useState<EmulatorSystem | "all">(
		"all"
	);
	const [scanning, setScanning] = useState(false);

	// Fetch games on mount
	useEffect(() => {
		fetchGames();
	}, []);

	// Fetch games from API
	const fetchGames = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch("/api/games");
			const result = await response.json();

			if (result.success) {
				setGames(result.data.games);
			} else {
				setError(result.error);
			}
		} catch (err) {
			setError("Failed to load games");
			console.error("[GameLibrary] Error:", err);
		} finally {
			setLoading(false);
		}
	};

	// Scan for new ROMs
	const handleScanRoms = async () => {
		try {
			setScanning(true);

			const response = await fetch("/api/games", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "scan" }),
			});

			const result = await response.json();

			if (result.success) {
				// Refresh games list
				await fetchGames();

				if (result.data.added > 0) {
					alert(`Found ${result.data.added} new game(s)!`);
				} else {
					alert("No new games found.");
				}
			} else {
				alert(`Scan failed: ${result.error}`);
			}
		} catch (err) {
			alert("Failed to scan for ROMs");
			console.error("[GameLibrary] Scan error:", err);
		} finally {
			setScanning(false);
		}
	};

	// Calculate system counts for filter badges
	const systemsWithCounts = useMemo<SystemInfo[]>(() => {
		const counts: Record<string, number> = {};

		for (const game of games) {
			counts[game.system] = (counts[game.system] || 0) + 1;
		}

		return Object.entries(counts)
			.map(([id, count]) => ({
				id: id as EmulatorSystem,
				name: SYSTEM_NAMES[id as EmulatorSystem] || id,
				count,
			}))
			.sort((a, b) => b.count - a.count);
	}, [games]);

	// Filter games by search and system
	const filteredGames = useMemo(() => {
		return games.filter((game) => {
			// Filter by system
			if (selectedSystem !== "all" && game.system !== selectedSystem) {
				return false;
			}

			// Filter by search query
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return game.title.toLowerCase().includes(query);
			}

			return true;
		});
	}, [games, selectedSystem, searchQuery]);

	// Sort games: recently played first, then alphabetically
	const sortedGames = useMemo(() => {
		return [...filteredGames].sort((a, b) => {
			// If both have lastPlayed, sort by most recent
			if (a.lastPlayed && b.lastPlayed) {
				return (
					new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime()
				);
			}
			// Games with lastPlayed come first
			if (a.lastPlayed) return -1;
			if (b.lastPlayed) return 1;
			// Otherwise alphabetical
			return a.title.localeCompare(b.title);
		});
	}, [filteredGames]);

	if (loading) {
		return (
			<div className="space-y-6">
				{/* Header skeleton */}
				<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
					<div>
						<div className="h-8 w-40 bg-zinc-800 rounded animate-pulse" />
						<div className="h-4 w-24 bg-zinc-800 rounded mt-2 animate-pulse" />
					</div>
					<div className="flex gap-3">
						<div className="h-10 w-48 bg-zinc-800 rounded-lg animate-pulse" />
						<div className="h-10 w-32 bg-zinc-800 rounded-lg animate-pulse" />
					</div>
				</div>

				{/* System filter skeleton */}
				<div className="flex gap-2">
					{[1, 2, 3, 4, 5].map((i) => (
						<div
							key={i}
							className="h-8 w-20 bg-zinc-800 rounded-full animate-pulse"
						/>
					))}
				</div>

				{/* Game cards skeleton */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
						<div
							key={i}
							className="bg-zinc-800/50 rounded-xl overflow-hidden border border-zinc-700/50"
						>
							<div className="aspect-4/3 bg-zinc-700 animate-pulse" />
							<div className="p-4 space-y-2">
								<div className="h-5 bg-zinc-700 rounded animate-pulse w-3/4" />
								<div className="h-4 bg-zinc-700/50 rounded animate-pulse w-1/2" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header with search and scan */}
			<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Game Library</h2>
					<p className="text-zinc-400 text-sm">
						{games.length} game{games.length !== 1 ? "s" : ""} total
						{selectedSystem !== "all" && ` • ${filteredGames.length} shown`}
					</p>
				</div>

				<div className="flex gap-3">
					{/* Search Input */}
					<div className="relative">
						<input
							type="text"
							placeholder="Search games..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="
                w-48 sm:w-64 px-4 py-2 pl-10
                bg-zinc-800 border border-zinc-700 rounded-lg
                text-sm placeholder:text-zinc-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              "
						/>
						<span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
							🔍
						</span>
					</div>

					{/* Scan Button */}
					<button
						onClick={handleScanRoms}
						disabled={scanning}
						className="
              px-4 py-2 rounded-lg
              bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50
              text-sm font-medium
              transition-colors
            "
					>
						{scanning ? "⏳ Scanning..." : "🔄 Scan for ROMs"}
					</button>
				</div>
			</div>

			{/* System Filter Tabs */}
			{systemsWithCounts.length > 1 && (
				<div className="flex flex-wrap gap-2">
					<button
						onClick={() => setSelectedSystem("all")}
						className={`
              px-3 py-1.5 rounded-full text-sm font-medium transition-all
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-950
              ${
								selectedSystem === "all"
									? "bg-blue-600 text-white"
									: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
							}
            `}
					>
						All ({games.length})
					</button>

					{systemsWithCounts.map((system) => (
						<button
							key={system.id}
							onClick={() => setSelectedSystem(system.id)}
							className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-950
                ${
									selectedSystem === system.id
										? "bg-blue-600 text-white"
										: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
								}
              `}
						>
							{system.name} ({system.count})
						</button>
					))}
				</div>
			)}

			{/* Error State */}
			{error && (
				<div className="p-6 rounded-lg bg-red-900/30 border border-red-700/50 text-center">
					<div className="text-4xl mb-3">⚠️</div>
					<p className="font-medium text-red-200 mb-1">Error loading games</p>
					<p className="text-sm text-red-300/80 mb-4">{error}</p>
					<button
						onClick={fetchGames}
						disabled={loading}
						className="
							px-4 py-2 rounded-lg
							bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50
							text-white font-medium text-sm
							transition-colors
						"
					>
						{loading ? "⏳ Retrying..." : "🔄 Try Again"}
					</button>
				</div>
			)}

			{/* Empty State */}
			{!error && games.length === 0 && (
				<div className="text-center py-20">
					<div className="text-6xl mb-4">📁</div>
					<h3 className="text-xl font-semibold mb-2">No games yet</h3>
					<p className="text-zinc-400 mb-6 max-w-md mx-auto">
						Add ROM files to the{" "}
						<code className="bg-zinc-800 px-2 py-0.5 rounded">public/roms</code>{" "}
						folder organized by system (e.g.,{" "}
						<code className="bg-zinc-800 px-2 py-0.5 rounded">
							public/roms/nes/
						</code>
						), then click &quot;Scan for ROMs&quot;.
					</p>
					<button
						onClick={handleScanRoms}
						disabled={scanning}
						className="
              px-6 py-3 rounded-lg
              bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
              font-medium
              transition-colors
            "
					>
						{scanning ? "⏳ Scanning..." : "🔄 Scan for ROMs"}
					</button>
				</div>
			)}

			{/* No Results State */}
			{!error && games.length > 0 && sortedGames.length === 0 && (
				<div className="text-center py-12">
					<div className="text-4xl mb-4">🔍</div>
					<h3 className="text-lg font-semibold mb-1">No games found</h3>
					<p className="text-zinc-400">
						Try adjusting your search or filter criteria.
					</p>
				</div>
			)}

			{/* Games Grid */}
			{sortedGames.length > 0 && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					{sortedGames.map((game) => (
						<GameCard key={game.id} game={game} onSelect={onSelectGame} />
					))}
				</div>
			)}
		</div>
	);
}
