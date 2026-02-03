/**
 * ServerStatus Component
 *
 * Displays connection info and server status.
 * Shows IP address for mobile connection.
 */

"use client";

import { useState, useEffect } from "react";

interface ServerStatusData {
	online: boolean;
	version: string;
	uptime: number;
	network: {
		primaryIp: string | null;
		allIps: string[];
		port: number;
	};
	emulation: {
		supportedSystems: string[];
	};
}

/**
 * Format uptime in human-readable format.
 */
function formatUptime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0) {
		return `${hours}h ${mins}m`;
	}
	if (mins > 0) {
		return `${mins}m ${secs}s`;
	}
	return `${secs}s`;
}

export function ServerStatus() {
	const [status, setStatus] = useState<ServerStatusData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		fetchStatus();

		// Refresh status every 10 seconds
		const interval = setInterval(fetchStatus, 10000);
		return () => clearInterval(interval);
	}, []);

	const fetchStatus = async () => {
		try {
			const response = await fetch("/api/status");
			const result = await response.json();

			if (result.success) {
				setStatus(result.data);
				setError(null);
			} else {
				setError(result.error);
			}
		} catch (err) {
			setError("Failed to fetch status");
		} finally {
			setLoading(false);
		}
	};

	const copyAddress = () => {
		if (status?.network.primaryIp) {
			const address = `http://${status.network.primaryIp}:${status.network.port}`;
			navigator.clipboard.writeText(address);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	if (loading) {
		return (
			<div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 animate-pulse">
				<div className="h-6 w-32 bg-zinc-700 rounded mb-4"></div>
				<div className="h-4 w-48 bg-zinc-700 rounded"></div>
			</div>
		);
	}

	if (error || !status) {
		return (
			<div className="p-4 rounded-xl bg-red-900/30 border border-red-700">
				<p className="text-red-300">⚠️ {error || "Unable to connect"}</p>
			</div>
		);
	}

	const serverAddress = status.network.primaryIp
		? `http://${status.network.primaryIp}:${status.network.port}`
		: null;

	return (
		<div className="p-6 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div
						className={`
            w-3 h-3 rounded-full
            ${status.online ? "bg-green-500 animate-pulse" : "bg-red-500"}
          `}
					/>
					<h3 className="font-semibold text-lg">Server Status</h3>
				</div>
				<span className="text-xs text-zinc-500">
					Uptime: {formatUptime(status.uptime)}
				</span>
			</div>

			{/* Network Info */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<span className="text-zinc-400 text-sm">Network Address</span>
					{serverAddress && (
						<button
							onClick={copyAddress}
							className="text-xs text-blue-400 hover:text-blue-300"
						>
							{copied ? "✓ Copied!" : "Copy"}
						</button>
					)}
				</div>

				{serverAddress ? (
					<div className="p-3 bg-zinc-900 rounded-lg font-mono text-sm break-all">
						{serverAddress}
					</div>
				) : (
					<p className="text-zinc-500 text-sm">No network address available</p>
				)}
			</div>

			{/* Supported Systems */}
			<div className="pt-4 border-t border-zinc-700 space-y-2">
				<span className="text-zinc-400 text-sm">Supported Systems</span>
				<p className="text-xs text-zinc-500">
					{status.emulation.supportedSystems.length} systems available
				</p>
			</div>

			{/* Mobile Connection Instructions */}
			<div className="pt-4 border-t border-zinc-700">
				<p className="text-sm text-zinc-400 mb-2">📱 To connect from mobile:</p>
				<ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
					<li>Connect to the same WiFi network as this PC</li>
					<li>Open the address above in your mobile browser</li>
					<li>Add to home screen for app-like experience</li>
				</ol>
			</div>
		</div>
	);
}
