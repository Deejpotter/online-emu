/**
 * GameCard Component
 *
 * Displays a single game in the library grid.
 * Shows cover art (or placeholder), title, system, and play stats.
 *
 * All games run via EmulatorJS in the browser - no external emulators needed.
 */

"use client";

import { useState } from "react";
import type { Game, EmulatorSystem } from "@/types";

interface GameCardProps {
	game: Game;
	onSelect: (game: Game) => void;
}

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
 * System-specific color schemes for visual distinction.
 */
const SYSTEM_COLORS: Record<string, string> = {
	nes: "bg-red-900/50 border-red-700",
	snes: "bg-purple-900/50 border-purple-700",
	gb: "bg-green-900/50 border-green-700",
	gba: "bg-indigo-900/50 border-indigo-700",
	n64: "bg-yellow-900/50 border-yellow-700",
	nds: "bg-blue-900/50 border-blue-700",
	segaMD: "bg-blue-900/50 border-blue-700",
	segaMS: "bg-cyan-900/50 border-cyan-700",
	segaGG: "bg-teal-900/50 border-teal-700",
	segaCD: "bg-sky-900/50 border-sky-700",
	psx: "bg-gray-800/50 border-gray-600",
	psp: "bg-slate-800/50 border-slate-600",
	atari2600: "bg-orange-900/50 border-orange-700",
	arcade: "bg-pink-900/50 border-pink-700",
};

/**
 * Format bytes to human-readable size.
 */
function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format relative time (e.g., "2 hours ago").
 */
function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins} min ago`;
	if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
	if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
	return date.toLocaleDateString();
}

export function GameCard({ game, onSelect }: GameCardProps) {
	const [isHovered, setIsHovered] = useState(false);
	const colorClass =
		SYSTEM_COLORS[game.system] || "bg-zinc-800/50 border-zinc-600";
	const systemName = SYSTEM_NAMES[game.system] || game.system;

	return (
		<button
			onClick={() => onSelect(game)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			className={`
        relative w-full text-left rounded-xl border-2 overflow-hidden
        transition-all duration-200 ease-out
        ${colorClass}
        ${isHovered ? "scale-105 shadow-xl shadow-black/50" : "scale-100"}
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-950
      `}
		>
			{/* Cover Art / Placeholder */}
			<div className="aspect-4/3 bg-zinc-900 flex items-center justify-center relative">
				{game.coverArt ? (
					<img
						src={game.coverArt}
						alt={game.title}
						className="w-full h-full object-cover"
					/>
				) : (
					<div className="text-6xl opacity-30">🎮</div>
				)}

				{/* Hover overlay with play button */}
				<div
					className={`
            absolute inset-0 bg-black/60 flex items-center justify-center
            transition-opacity duration-200
            ${isHovered ? "opacity-100" : "opacity-0"}
          `}
				>
					<div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
						<span className="text-3xl">▶️</span>
					</div>
				</div>
			</div>

			{/* Game Info */}
			<div className="p-4">
				<h3
					className="font-bold text-xl truncate mb-1.5 text-white"
					style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
				>
					{game.title}
				</h3>

				<div className="flex items-center gap-2 text-sm text-zinc-300">
					<span className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs">
						{systemName}
					</span>

					{game.fileSize && (
						<span className="text-xs opacity-60">
							{formatBytes(game.fileSize)}
						</span>
					)}
				</div>

				{/* Play stats */}
				{(game.playCount || game.lastPlayed) && (
					<div className="mt-2 pt-2 border-t border-zinc-800 text-xs text-zinc-500 flex items-center gap-3">
						{game.playCount !== undefined && game.playCount > 0 && (
							<span>
								🎮 {game.playCount} play{game.playCount > 1 ? "s" : ""}
							</span>
						)}
						{game.lastPlayed && (
							<span>🕒 {formatRelativeTime(game.lastPlayed)}</span>
						)}
					</div>
				)}
			</div>
		</button>
	);
}
