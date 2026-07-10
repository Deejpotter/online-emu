/**
 * Library bootstrap.
 *
 * On Coolify the container is ephemeral and has no local ROMs. The game
 * library (data/metadata.json) is therefore sourced from R2 when missing
 * locally. Set LIBRARY_SOURCE=r2 (default: local) and provide R2_* env.
 */

import fs from "fs/promises";
import path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const METADATA_PATH = path.join(DATA_DIR, "metadata.json");
const MANIFEST_KEY = "library/manifest.json";

function getR2Client(): S3Client | null {
	const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
	if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
	return new S3Client({
		region: "auto",
		endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: R2_ACCESS_KEY_ID,
			secretAccessKey: R2_SECRET_ACCESS_KEY,
		},
	});
}

async function streamToBuffer(body: any): Promise<Buffer> {
	const chunks: Uint8Array[] = [];
	const reader = body.transformToWebStream().getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const buf = Buffer.alloc(chunks.reduce((a, c) => a + c.length, 0));
	let off = 0;
	for (const c of chunks) {
		buf.set(c, off);
		off += c.length;
	}
	return buf;
}

/**
 * Ensure a library manifest exists locally.
 * If LIBRARY_SOURCE=r2 and R2 creds are present, seed from R2 when absent.
 * Falls back to an empty library if nothing is available.
 */
export async function ensureLibrary(): Promise<void> {
	await fs.mkdir(DATA_DIR, { recursive: true });
	try {
		await fs.access(METADATA_PATH);
		return; // already present (local disk or earlier seed)
	} catch {
		/* fall through */
	}

	if (process.env.LIBRARY_SOURCE === "r2") {
		const client = getR2Client();
		const bucket = process.env.R2_BUCKET_NAME || "deejpotter";
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
			} catch (e: any) {
				console.warn("[Library] R2 manifest fetch failed:", e.message);
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
