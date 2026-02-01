/**
 * Settings Page
 *
 * Allows users to configure:
 * - Sunshine streaming server (for PS2/GameCube streaming)
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

interface SunshineConfig {
	url: string;
	username: string;
	hasPassword: boolean;
	moonlightWebUrl: string;
	enabled: boolean;
}

interface SunshineStatus {
	enabled: boolean;
	configured: boolean;
	connected: boolean;
	error?: string;
}

export default function SettingsPage() {
	const [configs, setConfigs] = useState<EmulatorConfigs | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [editPath, setEditPath] = useState<Record<string, string>>({});

	// Sunshine state
	const [sunshineConfig, setSunshineConfig] = useState<SunshineConfig | null>(null);
	const [sunshineStatus, setSunshineStatus] = useState<SunshineStatus | null>(null);
	const [sunshineForm, setSunshineForm] = useState({
		url: "https://localhost:47990",
		username: "sunshine",
		password: "",
		moonlightWebUrl: "http://localhost:8080",
		enabled: false,
	});
	const [testingConnection, setTestingConnection] = useState(false);
	const [savingSunshine, setSavingSunshine] = useState(false);

	// Fetch emulator configs on mount
	useEffect(() => {
		fetchConfigs();
		fetchSunshineConfig();
		fetchSunshineStatus();
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

	async function fetchSunshineConfig() {
		try {
			const response = await fetch("/api/sunshine/config");
			const data = await response.json();
			setSunshineConfig(data);
			setSunshineForm({
				url: data.url || "https://localhost:47990",
				username: data.username || "sunshine",
				password: "",
				moonlightWebUrl: data.moonlightWebUrl || "http://localhost:8080",
				enabled: data.enabled || false,
			});
		} catch (err) {
			console.error("Failed to load Sunshine config:", err);
		}
	}

	async function fetchSunshineStatus() {
		try {
			const response = await fetch("/api/sunshine/status");
			const data = await response.json();
			setSunshineStatus(data);
		} catch (err) {
			console.error("Failed to fetch Sunshine status:", err);
		}
	}

	async function testSunshineConnection() {
		setTestingConnection(true);
		setError(null);

		try {
			const response = await fetch("/api/sunshine/config", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(sunshineForm),
			});

			const data = await response.json();

			if (data.success) {
				alert("✅ Connection successful! Sunshine is reachable.");
			} else {
				alert(`❌ Connection failed: ${data.error}`);
			}
		} catch {
			alert("❌ Connection test failed");
		} finally {
			setTestingConnection(false);
		}
	}

	async function saveSunshineConfig() {
		setSavingSunshine(true);
		setError(null);

		try {
			const response = await fetch("/api/sunshine/config", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(sunshineForm),
			});

			const data = await response.json();

			if (data.success) {
				await fetchSunshineConfig();
				await fetchSunshineStatus();
				alert("✅ Sunshine configuration saved!");
			} else {
				setError(data.error || "Failed to save Sunshine configuration");
			}
		} catch {
			setError("Failed to save Sunshine configuration");
		} finally {
			setSavingSunshine(false);
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

				{/* Sunshine Streaming Section */}
				<section className="mb-8">
					<h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
						<span className="text-2xl">📡</span>
						Sunshine Streaming
					</h2>
					<p className="text-zinc-400 text-sm mb-6">
						Configure Sunshine and moonlight-web-stream for streaming PS2 and
						GameCube games to your browser. This enables low-latency hardware-
						accelerated game streaming.
					</p>

					<div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 space-y-4">
						{/* Connection Status */}
						<div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
							<div className="flex items-center gap-3">
								<span className="text-2xl">
									{sunshineStatus?.connected
										? "🟢"
										: sunshineStatus?.enabled
											? "🟡"
											: "⚪"}
								</span>
								<div>
									<div className="font-medium">
										{sunshineStatus?.connected
											? "Connected"
											: sunshineStatus?.enabled
												? "Enabled (not connected)"
												: "Disabled"}
									</div>
									{sunshineStatus?.error && (
										<div className="text-xs text-red-400">
											{sunshineStatus.error}
										</div>
									)}
								</div>
							</div>
							<button
								onClick={fetchSunshineStatus}
								className="text-sm text-zinc-400 hover:text-white"
							>
								Refresh
							</button>
						</div>

						{/* Enable Toggle */}
						<div className="flex items-center justify-between">
							<label className="text-sm text-zinc-400">
								Enable Sunshine Integration
							</label>
							<button
								onClick={() =>
									setSunshineForm((prev) => ({
										...prev,
										enabled: !prev.enabled,
									}))
								}
								className={`relative w-12 h-6 rounded-full transition-colors ${
									sunshineForm.enabled ? "bg-violet-600" : "bg-zinc-700"
								}`}
							>
								<span
									className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
										sunshineForm.enabled ? "left-7" : "left-1"
									}`}
								/>
							</button>
						</div>

						{/* URL Fields */}
						<div>
							<label className="block text-sm text-zinc-400 mb-1">
								Sunshine URL
							</label>
							<input
								type="text"
								value={sunshineForm.url}
								onChange={(e) =>
									setSunshineForm((prev) => ({ ...prev, url: e.target.value }))
								}
								placeholder="https://localhost:47990"
								className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm text-zinc-400 mb-1">
									Username
								</label>
								<input
									type="text"
									value={sunshineForm.username}
									onChange={(e) =>
										setSunshineForm((prev) => ({
											...prev,
											username: e.target.value,
										}))
									}
									placeholder="sunshine"
									className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
								/>
							</div>
							<div>
								<label className="block text-sm text-zinc-400 mb-1">
									Password {sunshineConfig?.hasPassword && "(configured)"}
								</label>
								<input
									type="password"
									value={sunshineForm.password}
									onChange={(e) =>
										setSunshineForm((prev) => ({
											...prev,
											password: e.target.value,
										}))
									}
									placeholder={
										sunshineConfig?.hasPassword
											? "Leave blank to keep current"
											: "Enter Sunshine password"
									}
									className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm text-zinc-400 mb-1">
								moonlight-web-stream URL
							</label>
							<input
								type="text"
								value={sunshineForm.moonlightWebUrl}
								onChange={(e) =>
									setSunshineForm((prev) => ({
										...prev,
										moonlightWebUrl: e.target.value,
									}))
								}
								placeholder="http://localhost:8080"
								className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
							/>
							<p className="text-xs text-zinc-500 mt-1">
								This is where the streaming player is served from
							</p>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-2 pt-2">
							<button
								onClick={testSunshineConnection}
								disabled={testingConnection}
								className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 rounded text-sm font-medium transition-colors"
							>
								{testingConnection ? "Testing..." : "Test Connection"}
							</button>
							<button
								onClick={saveSunshineConfig}
								disabled={savingSunshine}
								className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 rounded text-sm font-medium transition-colors"
							>
								{savingSunshine ? "Saving..." : "Save Configuration"}
							</button>
						</div>
					</div>
				</section>

				{/* External Emulators Section */}
				<section className="mb-8">
					<h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
						<span className="text-2xl">🎮</span>
						External Emulators
					</h2>
					<p className="text-zinc-400 text-sm mb-6">
						Configure paths to external emulators for PS2 and GameCube games.
						These emulators run on your PC and the video is streamed to your
						device.
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
