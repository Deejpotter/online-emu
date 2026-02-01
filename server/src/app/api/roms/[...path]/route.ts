/**
 * ROM File Server API
 *
 * Serves ROM files from the external games directory.
 * Route: GET /api/roms/{...path}
 *
 * This allows the emulator to load ROMs from an external folder
 * like H:\Games\NES\ROMs\game.zip
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getGamesDirectory } from "@/lib/game-library";

// MIME types for ROM files
const MIME_TYPES: Record<string, string> = {
	".zip": "application/zip",
	".nes": "application/octet-stream",
	".sfc": "application/octet-stream",
	".smc": "application/octet-stream",
	".gb": "application/octet-stream",
	".gbc": "application/octet-stream",
	".gba": "application/octet-stream",
	".n64": "application/octet-stream",
	".z64": "application/octet-stream",
	".v64": "application/octet-stream",
	".nds": "application/octet-stream",
	".md": "application/octet-stream",
	".gen": "application/octet-stream",
	".sms": "application/octet-stream",
	".gg": "application/octet-stream",
	".iso": "application/octet-stream",
	".bin": "application/octet-stream",
	".cue": "text/plain",
	".cso": "application/octet-stream",
	".a26": "application/octet-stream",
	".img": "application/octet-stream",
	".fds": "application/octet-stream",
	".pbp": "application/octet-stream",
};

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> }
) {
	try {
		const { path: pathSegments } = await params;
		const gamesDir = getGamesDirectory();

		// Reconstruct the file path from URL segments
		const relativePath = pathSegments.join("/");
		const filePath = path.join(gamesDir, relativePath);

		// Security check: ensure the resolved path is within the games directory
		const resolvedPath = path.resolve(filePath);
		const resolvedGamesDir = path.resolve(gamesDir);

		if (!resolvedPath.startsWith(resolvedGamesDir)) {
			return NextResponse.json({ error: "Invalid path" }, { status: 403 });
		}

		// Check if file exists
		try {
			await fs.access(filePath);
		} catch {
			return NextResponse.json({ error: "ROM not found" }, { status: 404 });
		}

		// Read the file
		const fileBuffer = await fs.readFile(filePath);
		const ext = path.extname(filePath).toLowerCase();
		const contentType = MIME_TYPES[ext] || "application/octet-stream";

		// Return the file with appropriate headers
		return new NextResponse(fileBuffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Length": fileBuffer.length.toString(),
				"Cache-Control": "public, max-age=31536000", // Cache for 1 year
			},
		});
	} catch (error) {
		console.error("[ROM API] Error serving ROM:", error);
		return NextResponse.json({ error: "Failed to load ROM" }, { status: 500 });
	}
}
