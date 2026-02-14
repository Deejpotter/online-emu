/**
 * GameLibrary Component
 *
 * Main component for browsing and managing the game library.
 * Includes filtering by system, search, alphabet jump navigation,
 * and grid/list view toggle for better mobile browsing.
 */

"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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

type ViewMode = "grid" | "list";
type SortMode = "alpha" | "recent" | "system";

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
};

/**
 * System-specific color schemes for list view badges.
 */
const SYSTEM_BADGE_COLORS: Record<string, string> = {
	nes: "bg-red-700",
	snes: "bg-purple-700",
	gb: "bg-green-700",
	gba: "bg-indigo-700",
	n64: "bg-yellow-700",
	nds: "bg-blue-700",
	segaMD: "bg-blue-600",
	segaMS: "bg-cyan-700",
	segaGG: "bg-teal-700",
	segaCD: "bg-sky-700",
	psx: "bg-gray-600",
	psp: "bg-slate-600",
	atari2600: "bg-orange-700",
	arcade: "bg-pink-700",
	ps2: "bg-violet-700",
	gamecube: "bg-violet-600",
};

const ALPHABET = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function GameLibrary({ onSelectGame }: GameLibraryProps) {
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedSystem, setSelectedSystem] = useState<EmulatorSystem | "all">(
		"all"
	);
	const [scanning, setScanning] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [sortMode, setSortMode] = useState<SortMode>("alpha");

	// Refs for alphabet jump navigation
	const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

	// Sort games based on selected sort mode
	const sortedGames = useMemo(() => {
		return [...filteredGames].sort((a, b) => {
			switch (sortMode) {
				case "recent":
					// If both have lastPlayed, sort by most recent
					if (a.lastPlayed && b.lastPlayed) {
						return (
							new Date(b.lastPlayed).getTime() -
							new Date(a.lastPlayed).getTime()
						);
					}
					// Games with lastPlayed come first
					if (a.lastPlayed) return -1;
					if (b.lastPlayed) return 1;
					// Otherwise alphabetical
					return a.title.localeCompare(b.title);

				case "system":
					// Group by system, then alphabetical within system
					const systemCompare = a.system.localeCompare(b.system);
					if (systemCompare !== 0) return systemCompare;
					return a.title.localeCompare(b.title);

				case "alpha":
				default:
					return a.title.localeCompare(b.title);
			}
		});
	}, [filteredGames, sortMode]);

	// Group games by first letter for alphabet navigation
	const gamesByLetter = useMemo(() => {
		const groups: Record<string, Game[]> = {};

		for (const game of sortedGames) {
			const firstChar = game.title.charAt(0).toUpperCase();
			const letter = /[A-Z]/.test(firstChar) ? firstChar : "#";

			if (!groups[letter]) {
				groups[letter] = [];
			}
			groups[letter].push(game);
		}

		return groups;
	}, [sortedGames]);

	// Letters that have games (for highlighting in alphabet bar)
	const activeLetters = useMemo(() => {
		return new Set(Object.keys(gamesByLetter));
	}, [gamesByLetter]);

	// Jump to a letter section
	const jumpToLetter = useCallback((letter: string) => {
		const ref = sectionRefs.current[letter];
		if (ref) {
			ref.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}, []);

	// Format relative time for list view
	const formatRelativeTime = (dateString: string): string => {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "Today";
		if (diffDays === 1) return "Yesterday";
		if (diffDays < 7) return `${diffDays}d ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
		return date.toLocaleDateString();
	};

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
		<div className="space-y-4">
			{/* Header with search, view toggle, and scan */}
			<div className="flex flex-col gap-3">
				{/* Title and count */}
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-xl sm:text-2xl font-bold">Game Library</h2>
						<p className="text-zinc-400 text-xs sm:text-sm">
							{games.length} game{games.length !== 1 ? "s" : ""} total
							{selectedSystem !== "all" && ` • ${filteredGames.length} shown`}
						</p>
					</div>

					{/* View Mode Toggle */}
					<div className="flex items-center gap-2">
						<div className="flex bg-zinc-800 rounded-lg p-1">
							<button
								onClick={() => setViewMode("grid")}
								className={`p-2 rounded transition-colors ${
									viewMode === "grid"
										? "bg-zinc-700 text-white"
										: "text-zinc-400 hover:text-white"
								}`}
								title="Grid view"
							>
								<svg
									className="w-4 h-4"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
								</svg>
							</button>
							<button
								onClick={() => setViewMode("list")}
								className={`p-2 rounded transition-colors ${
									viewMode === "list"
										? "bg-zinc-700 text-white"
										: "text-zinc-400 hover:text-white"
								}`}
								title="List view"
							>
								<svg
									className="w-4 h-4"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fillRule="evenodd"
										d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
										clipRule="evenodd"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>

				{/* Search and controls row */}
				<div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
					{/* Search Input */}
					<div className="relative flex-1">
						<input
							type="text"
							placeholder="Search games..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="
								w-full px-4 py-2.5 pl-10
								bg-zinc-800 border border-zinc-700 rounded-lg
								text-sm placeholder:text-zinc-500
								focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
							"
						/>
						<span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
							🔍
						</span>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
							>
								✕
							</button>
						)}
					</div>

					{/* Sort dropdown */}
					<select
						value={sortMode}
						onChange={(e) => setSortMode(e.target.value as SortMode)}
						className="
							px-3 py-2.5 rounded-lg
							bg-zinc-800 border border-zinc-700
							text-sm text-zinc-300
							focus:outline-none focus:ring-2 focus:ring-blue-500
						"
					>
						<option value="alpha">A-Z</option>
						<option value="recent">Recent</option>
						<option value="system">By System</option>
					</select>

					{/* Scan Button */}
					<button
						onClick={handleScanRoms}
						disabled={scanning}
						className="
							px-4 py-2.5 rounded-lg
							bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50
							text-sm font-medium whitespace-nowrap
							transition-colors
						"
					>
						{scanning ? "⏳" : "🔄"} Scan
					</button>
				</div>
			</div>

			{/* System Filter Tabs - horizontal scroll on mobile */}
			{systemsWithCounts.length > 1 && (
				<div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
					<button
						onClick={() => setSelectedSystem("all")}
						className={`
							px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0
							focus:outline-none focus:ring-2 focus:ring-blue-500
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
								px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0
								focus:outline-none focus:ring-2 focus:ring-blue-500
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

			{/* Games Display - with alphabet sidebar on large screens */}
			{sortedGames.length > 0 && (
				<div className="flex gap-2">
					{/* Alphabet Jump Bar - only show for alpha sort without search */}
					{sortMode === "alpha" && !searchQuery && sortedGames.length > 20 && (
						<div className="hidden md:flex flex-col gap-0.5 sticky top-4 h-fit">
							{ALPHABET.map((letter) => (
								<button
									key={letter}
									onClick={() => jumpToLetter(letter)}
									disabled={!activeLetters.has(letter)}
									className={`
										w-6 h-6 text-xs font-medium rounded transition-colors
										${
											activeLetters.has(letter)
												? "text-zinc-300 hover:bg-blue-600 hover:text-white"
												: "text-zinc-700 cursor-default"
										}
									`}
								>
									{letter}
								</button>
							))}
						</div>
					)}

					{/* Games Content */}
					<div className="flex-1 min-w-0">
						{/* Grid View */}
						{viewMode === "grid" && (
							<>
								{sortMode === "alpha" && !searchQuery ? (
									// Grouped by letter
									<div className="space-y-6">
										{ALPHABET.filter((letter) => gamesByLetter[letter]).map(
											(letter) => (
												<div
													key={letter}
													ref={(el) => {
														sectionRefs.current[letter] = el;
													}}
												>
													<div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur py-2 mb-3 border-b border-zinc-800">
														<span className="text-lg font-bold text-zinc-400">
															{letter}
														</span>
														<span className="text-xs text-zinc-600 ml-2">
															{gamesByLetter[letter].length} game
															{gamesByLetter[letter].length !== 1 ? "s" : ""}
														</span>
													</div>
													<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
														{gamesByLetter[letter].map((game) => (
															<GameCard
																key={game.id}
																game={game}
																onSelect={onSelectGame}
															/>
														))}
													</div>
												</div>
											)
										)}
									</div>
								) : (
									// Flat grid (search results or other sort modes)
									<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
										{sortedGames.map((game) => (
											<GameCard
												key={game.id}
												game={game}
												onSelect={onSelectGame}
											/>
										))}
									</div>
								)}
							</>
						)}

						{/* List View - compact rows */}
						{viewMode === "list" && (
							<>
								{sortMode === "alpha" && !searchQuery ? (
									// Grouped by letter
									<div className="space-y-4">
										{ALPHABET.filter((letter) => gamesByLetter[letter]).map(
											(letter) => (
												<div
													key={letter}
													ref={(el) => {
														sectionRefs.current[letter] = el;
													}}
												>
													<div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur py-2 mb-2 border-b border-zinc-800">
														<span className="text-lg font-bold text-zinc-400">
															{letter}
														</span>
														<span className="text-xs text-zinc-600 ml-2">
															{gamesByLetter[letter].length} game
															{gamesByLetter[letter].length !== 1 ? "s" : ""}
														</span>
													</div>
													<div className="space-y-1">
														{gamesByLetter[letter].map((game) => (
															<button
																key={game.id}
																onClick={() => onSelectGame(game)}
																className="
																w-full flex items-center gap-3 p-3 rounded-lg
																bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50
																transition-colors text-left
															"
															>
																{/* Mini thumbnail or icon */}
																<div className="w-12 h-12 flex-shrink-0 rounded bg-zinc-900 flex items-center justify-center overflow-hidden">
																	{game.coverArt ? (
																		<img
																			src={game.coverArt}
																			alt=""
																			className="w-full h-full object-cover"
																		/>
																	) : (
																		<span className="text-xl opacity-50">
																			🎮
																		</span>
																	)}
																</div>

																{/* Game info */}
																<div className="flex-1 min-w-0">
																	<div className="font-semibold text-sm md:text-base text-white truncate">
																		{game.title}
																	</div>
																	<div className="flex items-center gap-2 mt-0.5">
																		<span
																			className={`text-xs px-1.5 py-0.5 rounded ${
																				SYSTEM_BADGE_COLORS[game.system] ||
																				"bg-zinc-700"
																			}`}
																		>
																			{SYSTEM_NAMES[game.system] || game.system}
																		</span>
																		{game.lastPlayed && (
																			<span className="text-xs text-zinc-500">
																				{formatRelativeTime(game.lastPlayed)}
																			</span>
																		)}
																	</div>
																</div>

																{/* Play indicator */}
																<div className="text-zinc-500 text-xl">▶</div>
															</button>
														))}
													</div>
												</div>
											)
										)}
									</div>
								) : (
									// Flat list
									<div className="space-y-1">
										{sortedGames.map((game) => (
											<button
												key={game.id}
												onClick={() => onSelectGame(game)}
												className="
													w-full flex items-center gap-3 p-3 rounded-lg
													bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50
													transition-colors text-left
												"
											>
												{/* Mini thumbnail or icon */}
												<div className="w-12 h-12 flex-shrink-0 rounded bg-zinc-900 flex items-center justify-center overflow-hidden">
													{game.coverArt ? (
														<img
															src={game.coverArt}
															alt=""
															className="w-full h-full object-cover"
														/>
													) : (
														<span className="text-xl opacity-50">🎮</span>
													)}
												</div>

												{/* Game info */}
												<div className="flex-1 min-w-0">
													<div className="font-semibold text-sm md:text-base text-white truncate">
														{game.title}
													</div>
													<div className="flex items-center gap-2 mt-0.5">
														<span
															className={`text-xs px-1.5 py-0.5 rounded ${
																SYSTEM_BADGE_COLORS[game.system] ||
																"bg-zinc-700"
															}`}
														>
															{SYSTEM_NAMES[game.system] || game.system}
														</span>
														{game.lastPlayed && (
															<span className="text-xs text-zinc-500">
																{formatRelativeTime(game.lastPlayed)}
															</span>
														)}
													</div>
												</div>

												{/* Play indicator */}
												<div className="text-zinc-500 text-xl">▶</div>
											</button>
										))}
									</div>
								)}
							</>
						)}
					</div>

					{/* Mobile Alphabet Quick Jump - floating button */}
					{sortMode === "alpha" && !searchQuery && sortedGames.length > 20 && (
						<div className="md:hidden fixed bottom-4 right-4 z-20">
							<details className="relative">
								<summary className="w-12 h-12 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg flex items-center justify-center cursor-pointer list-none text-lg font-bold">
									A-Z
								</summary>
								<div className="absolute bottom-14 right-0 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-2 grid grid-cols-7 gap-1 w-56">
									{ALPHABET.map((letter) => (
										<button
											key={letter}
											onClick={(e) => {
												jumpToLetter(letter);
												// Close the details
												const details = (e.target as HTMLElement).closest(
													"details"
												);
												if (details) details.removeAttribute("open");
											}}
											disabled={!activeLetters.has(letter)}
											className={`
												w-7 h-7 text-sm font-medium rounded transition-colors
												${
													activeLetters.has(letter)
														? "text-zinc-300 hover:bg-blue-600 hover:text-white"
														: "text-zinc-700 cursor-default"
												}
											`}
										>
											{letter}
										</button>
									))}
								</div>
							</details>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
