/**
 * Settings Page
 *
 * Allows users to configure:
 * - External emulator paths (PCSX2, Dolphin)
 * - Future: Profile preferences, display settings, etc.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface EmulatorConfig {
	system: string;
	name: string;
	executablePath: string;
	launchArgs: string[];
	isConfigured: boolean;
}

interface EmulatorConfigs {
	emulators: Record<string, EmulatorConfig>;
	externalSystems: string[];
}

export default function SettingsPage() {
	const [configs, setConfigs] = useState<EmulatorConfigs | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [editPath, setEditPath] = useState<Record<string, string>>({});

	// Fetch emulator configs on mount
	useEffect(() => {
		fetchConfigs();
	}, []);

	async function fetchConfigs() {
		try {
			const response = await fetch("/api/config/emulators");
			const data = await response.json();
			setConfigs(data);

			// Initialize edit paths
			const paths: Record<string, string> = {};
			for (const [system, config] of Object.entries(data.emulators)) {
				paths[system] = (config as EmulatorConfig).executablePath;
			}
			setEditPath(paths);
		} catch (err) {
			setError("Failed to load emulator configuration");
			console.error(err);
		} finally {
			setLoading(false);
		}
	}

	async function saveEmulatorPath(system: string) {
		setSaving(system);
		setError(null);

		try {
			const response = await fetch("/api/config/emulators", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					system,
					executablePath: editPath[system],
				}),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to save");
			}

			// Refresh configs
			await fetchConfigs();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(null);
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen bg-zinc-950 flex items-center justify-center">
				<div className="text-zinc-400">Loading settings...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-zinc-950 p-4 md:p-8">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="flex items-center gap-4 mb-8">
					<Link
						href="/"
						className="text-zinc-400 hover:text-white transition-colors"
					>
						← Back
					</Link>
					<h1 className="text-2xl font-bold">Settings</h1>
				</div>

				{/* Error Display */}
				{error && (
					<div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300">
						{error}
					</div>
				)}

				{/* External Emulators Section */}
				<section className="mb-8">
					<h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
						<span className="text-2xl">🎮</span>
						External Emulators
					</h2>
					<p className="text-zinc-400 text-sm mb-6">
						Configure paths to external emulators for PS2 and GameCube games.
						These emulators run on your PC when you launch a game.
					</p>

					<div className="space-y-6">
						{configs?.externalSystems.map((system) => {
							const config = configs.emulators[system];
							if (!config) return null;

							return (
								<div
									key={system}
									className="bg-zinc-900 rounded-lg p-4 border border-zinc-800"
								>
									<div className="flex items-start justify-between mb-3">
										<div>
											<h3 className="font-medium flex items-center gap-2">
												{config.name}
												{config.isConfigured ? (
													<span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
														Configured
													</span>
												) : (
													<span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
														Not Configured
													</span>
												)}
											</h3>
											<p className="text-zinc-500 text-sm">
												{system === "ps2" && "PlayStation 2 emulator"}
												{system === "gamecube" && "GameCube/Wii emulator"}
											</p>
										</div>
									</div>

									{/* Executable Path */}
									<div className="mb-3">
										<label className="block text-sm text-zinc-400 mb-1">
											Executable Path
										</label>
										<div className="flex gap-2">
											<input
												type="text"
												value={editPath[system] || ""}
												onChange={(e) =>
													setEditPath((prev) => ({
														...prev,
														[system]: e.target.value,
													}))
												}
												placeholder={
													system === "ps2"
														? "C:\\Program Files\\PCSX2\\pcsx2-qt.exe"
														: "C:\\Program Files\\Dolphin\\Dolphin.exe"
												}
												className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm 
													focus:border-blue-500 focus:outline-none placeholder-zinc-600"
											/>
											<button
												onClick={() => saveEmulatorPath(system)}
												disabled={saving === system}
												className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 
													rounded text-sm font-medium transition-colors"
											>
												{saving === system ? "Saving..." : "Save"}
											</button>
										</div>
									</div>

									{/* Launch Arguments (read-only for now) */}
									<div>
										<label className="block text-sm text-zinc-400 mb-1">
											Launch Arguments
										</label>
										<code className="block text-xs bg-zinc-800/50 p-2 rounded text-zinc-500 font-mono">
											{config.launchArgs.join(" ")}
										</code>
									</div>
								</div>
							);
						})}
					</div>
				</section>

				{/* Help Section */}
				<section className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
					<h3 className="font-medium mb-2 flex items-center gap-2">
						<span>💡</span>
						Setup Instructions
					</h3>
					<ol className="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
						<li>
							Download and install{" "}
							<a
								href="https://pcsx2.net/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-400 hover:underline"
							>
								PCSX2
							</a>{" "}
							for PS2 games or{" "}
							<a
								href="https://dolphin-emu.org/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-400 hover:underline"
							>
								Dolphin
							</a>{" "}
							for GameCube games
						</li>
						<li>Configure the emulator with your BIOS files and settings</li>
						<li>Copy the full path to the executable (e.g., pcsx2-qt.exe)</li>
						<li>Paste the path above and click Save</li>
						<li>PS2/GameCube games will now launch in the external emulator</li>
					</ol>
				</section>
			</div>
		</div>
	);
}
