/**
 * Server Status API Route
 *
 * GET /api/status - Get basic server status
 */

import { NextResponse } from "next/server";
import { getSupportedSystems } from "@/lib/game-library";
import type { ApiResponse } from "@/types";
import os from "os";

interface ServerStatus {
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

// Track server start time
const serverStartTime = Date.now();

/**
 * Get primary local IP address
 */
function getPrimaryLocalIp(): string | null {
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces)) {
		const iface = interfaces[name];
		if (!iface) continue;

		for (const alias of iface) {
			if (alias.family === "IPv4" && !alias.internal) {
				return alias.address;
			}
		}
	}
	return null;
}

/**
 * Get all local IP addresses
 */
function getAllLocalIps(): string[] {
	const ips: string[] = [];
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces)) {
		const iface = interfaces[name];
		if (!iface) continue;

		for (const alias of iface) {
			if (alias.family === "IPv4" && !alias.internal) {
				ips.push(alias.address);
			}
		}
	}
	return ips;
}

/**
 * GET /api/status
 *
 * Returns current server status.
 */
export async function GET() {
	try {
		const status: ServerStatus = {
			online: true,
			version: "1.0.0",
			uptime: Math.floor((Date.now() - serverStartTime) / 1000), // seconds
			network: {
				primaryIp: getPrimaryLocalIp(),
				allIps: getAllLocalIps(),
				port: parseInt(process.env.PORT || "3000", 10),
			},
			emulation: {
				supportedSystems: getSupportedSystems(),
			},
		};

		const response: ApiResponse<ServerStatus> = {
			success: true,
			data: status,
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("[API] Error getting status:", error);

		return NextResponse.json(
			{
				success: false,
				error: "Failed to get server status",
			},
			{ status: 500 }
		);
	}
}
