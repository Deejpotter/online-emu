/**
 * ROM streaming API — R2 first, local disk fallback.
 *
 * GET /api/roms/{path...}
 * Example: /api/roms/GB/ROMs/game.zip
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getGamesDirectory } from "@/lib/game-library";
import { fetchR2Object } from "@/lib/r2-client";

const R2_PREFIX = "roms/";

function contentTypeFor(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	switch (ext) {
		case ".zip":
			return "application/zip";
		case ".nes":
		case ".fds":
		case ".sfc":
		case ".smc":
		case ".gb":
		case ".gbc":
		case ".gba":
		case ".n64":
		case ".z64":
		case ".v64":
			return "application/octet-stream";
		default:
			return "application/octet-stream";
	}
}

function resolveLocalRomPath(segments: string[]): string | null {
	const gamesDir = getGamesDirectory();
	const relativePath = segments.map(decodeURIComponent).join(path.sep);
	const localPath = path.join(gamesDir, relativePath);
	const resolved = path.resolve(localPath);
	const resolvedGamesDir = path.resolve(gamesDir);

	if (!resolved.startsWith(resolvedGamesDir + path.sep) && resolved !== resolvedGamesDir) {
		return null;
	}

	return localPath;
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> }
) {
	try {
		const { path: segments } = await params;
		if (!segments?.length) {
			return NextResponse.json(
				{ success: false, error: "ROM path required" },
				{ status: 400 }
			);
		}

		const relativePath = segments.map(decodeURIComponent).join("/");
		const r2Key = `${R2_PREFIX}${relativePath.replace(/\\/g, "/")}`;

		const fromR2 = await fetchR2Object(r2Key);
		if (fromR2) {
			return new NextResponse(new Uint8Array(fromR2), {
				status: 200,
				headers: {
					"Content-Type": contentTypeFor(relativePath),
					"Content-Length": fromR2.length.toString(),
					"X-ROM-Source": "r2",
					"Cache-Control": "public, max-age=86400",
				},
			});
		}

		const localPath = resolveLocalRomPath(segments);
		if (!localPath) {
			return NextResponse.json(
				{ success: false, error: "Invalid ROM path" },
				{ status: 403 }
			);
		}

		try {
			const data = await fs.readFile(localPath);
			return new NextResponse(new Uint8Array(data), {
				status: 200,
				headers: {
					"Content-Type": contentTypeFor(relativePath),
					"Content-Length": data.length.toString(),
					"X-ROM-Source": "local",
					"Cache-Control": "public, max-age=3600",
				},
			});
		} catch {
			return NextResponse.json(
				{ success: false, error: "ROM not found" },
				{ status: 404 }
			);
		}
	} catch (error) {
		console.error("[API] Error serving ROM:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to serve ROM",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
