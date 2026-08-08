#!/usr/bin/env node
/**
 * Download library/manifest.json from R2 into data/metadata.json.
 * Use when local metadata is empty but R2 already has the canonical library.
 */

const fs = require("fs");
const path = require("path");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
	for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
		const t = line.trim();
		if (!t || t.startsWith("#")) continue;
		const i = t.indexOf("=");
		if (i === -1) continue;
		const k = t.slice(0, i).trim();
		const v = t.slice(i + 1).trim();
		if (!process.env[k]) process.env[k] = v;
	}
}

const BUCKET = process.env.R2_BUCKET_NAME || "deejpotter";
const KEY = "library/manifest.json";
const OUT = path.join(__dirname, "..", "data", "metadata.json");
const KEEP = new Set(["nes", "snes", "gb", "gba", "n64"]);

const client = new S3Client({
	region: "auto",
	endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
	},
});

(async () => {
	const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
	const chunks = [];
	for await (const chunk of res.Body) chunks.push(chunk);
	const manifest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	const before = manifest.games?.length ?? 0;
	manifest.games = (manifest.games || []).filter((g) => KEEP.has(g.system));
	manifest.lastUpdated = new Date().toISOString();

	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
	console.log(
		`Seeded ${OUT}: kept ${manifest.games.length} of ${before} games (5 systems only)`
	);
})().catch((e) => {
	console.error("FATAL", e.message);
	process.exit(1);
});
