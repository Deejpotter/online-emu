/**
 * Library bootstrap.
 *
 * On Coolify the container is ephemeral and has no local ROMs. The game
 * library (data/metadata.json) is therefore sourced from R2 when missing
 * locally. Set LIBRARY_SOURCE=r2 (default: local) and provide R2_* env.
 */

import fs from "fs/promises";
import path from "path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket, streamToBuffer } from "./r2-client";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const METADATA_PATH = path.join(DATA_DIR, "metadata.json");
const MANIFEST_KEY = "library/manifest.json";

/**
 * Ensure a library manifest exists locally.
 * If LIBRARY_SOURCE=r2 and R2 creds are present, seed from R2 when absent.
 * Falls back to an empty library if nothing is available.
 */
export async function ensureLibrary(): Promise<void> {
	await fs.mkdir(DATA_DIR, { recursive: true });

	let needsSeed = false;
	try {
		const raw = await fs.readFile(METADATA_PATH, "utf-8");
		const parsed = JSON.parse(raw) as { games?: unknown[] };
		if ((parsed.games?.length ?? 0) > 0) return;
		needsSeed = true;
	} catch {
		needsSeed = true;
	}

	if (!needsSeed) return;

	if (process.env.LIBRARY_SOURCE === "r2") {
		const client = getR2Client();
		const bucket = getR2Bucket();
		if (client) {
			try {
				const res = await client.send(
					new GetObjectCommand({ Bucket: bucket, Key: MANIFEST_KEY })
				);
				if (res.Body) {
					await fs.writeFile(METADATA_PATH, await streamToBuffer(res.Body));
					console.log("[Library] Seeded metadata.json from R2");
					return;
				}
			} catch (e: unknown) {
				const message = e instanceof Error ? e.message : String(e);
				console.warn("[Library] R2 manifest fetch failed:", message);
			}
		}
	}

	// Empty library fallback
	await fs.writeFile(
		METADATA_PATH,
		JSON.stringify({ games: [], lastUpdated: new Date().toISOString() }, null, 2)
	);
	console.log("[Library] No metadata found locally or in R2 — starting empty");
}
