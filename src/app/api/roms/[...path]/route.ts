/**
 * ROM File Server API
 *
 * Serves ROM files from Cloudflare R2 (primary) or local disk (fallback).
 * Route: GET /api/roms/{...path}
 *
 * R2 key structure: roms/{system}/ROMs/{filename}
 * Local fallback:  {GAMES_DIR}/{system}/ROMs/{filename}
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { Buffer } from "buffer";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
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

// R2 client — initialized once (module-level singleton)
let r2Client: S3Client | null = null;
const R2_PREFIX = "roms/";

function getR2Client(): S3Client | null {
	if (r2Client) return r2Client;

	const accountId = process.env.R2_ACCOUNT_ID;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

	if (!accountId || !accessKeyId || !secretAccessKey) {
		console.warn("[ROM API] R2 credentials not set — local disk only");
		return null;
	}

	r2Client = new S3Client({
		region: "auto",
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId, secretAccessKey },
	});
	return r2Client;
}

/**
 * Try to fetch a ROM from Cloudflare R2.
 * Returns the response body as a Uint8Array, or null if not found.
 */
async function fetchFromR2(
	relativePath: string
): Promise<{ data: Buffer; contentType: string } | null> {
	const client = getR2Client();
	if (!client) return null;

	const key = `${R2_PREFIX}${relativePath}`;
	const bucket = process.env.R2_BUCKET_NAME || "deejpotter";

	try {
		const response = await client.send(
			new GetObjectCommand({ Bucket: bucket, Key: key })
		);

		if (!response.Body) return null;

		// Convert stream to Buffer
		const chunks: Uint8Array[] = [];
		const reader = response.Body.transformToWebStream().getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
		}

		const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
		const data = Buffer.alloc(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			data.set(chunk, offset);
			offset += chunk.length;
		}

		const ext = path.extname(relativePath).toLowerCase();
		const contentType =
			response.ContentType || MIME_TYPES[ext] || "application/octet-stream";

		return { data, contentType };
	} catch (err: any) {
		// 404 = not in R2 yet, not an error
		if (
			err.name === "NoSuchKey" ||
			err.$metadata?.httpStatusCode === 404
		) {
			return null;
		}
		// Other errors — log but fall back to local
		console.warn(`[ROM API] R2 fetch failed for ${key}:`, err.message);
		return null;
	}
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> }
) {
	try {
		const { path: pathSegments } = await params;
		const gamesDir = getGamesDirectory();

		// Reconstruct the file path from URL segments
		const relativePath = pathSegments.join("/");
		const ext = path.extname(relativePath).toLowerCase();
		const contentType = MIME_TYPES[ext] || "application/octet-stream";

		// ── Try R2 first ──────────────────────────────────────────────
		const r2Result = await fetchFromR2(relativePath);
		if (r2Result) {
			return new Response(new Uint8Array(r2Result.data), {
				status: 200,
				headers: {
					"Content-Type": r2Result.contentType,
					"Content-Length": r2Result.data.length.toString(),
					"Cache-Control": "public, max-age=31536000",
					"X-ROM-Source": "r2",
				},
			});
		}

		// ── Fallback: local disk ──────────────────────────────────────
		const filePath = path.join(gamesDir, relativePath);

		// Security check: ensure the resolved path is within the games directory
		const resolvedPath = path.resolve(filePath);
		const resolvedGamesDir = path.resolve(gamesDir);

		if (!resolvedPath.startsWith(resolvedGamesDir)) {
			return NextResponse.json({ error: "Invalid path" }, { status: 403 });
		}

		// Check if file exists locally
		try {
			await fs.access(filePath);
		} catch {
			return NextResponse.json(
				{ error: "ROM not found" },
				{ status: 404 }
			);
		}

		// Read from local disk
		const fileBuffer = await fs.readFile(filePath);

		return new NextResponse(fileBuffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Length": fileBuffer.length.toString(),
				"Cache-Control": "public, max-age=31536000",
				"X-ROM-Source": "local",
			},
		});
	} catch (error) {
		console.error("[ROM API] Error serving ROM:", error);
		return NextResponse.json(
			{ error: "Failed to load ROM" },
			{ status: 500 }
		);
	}
}
