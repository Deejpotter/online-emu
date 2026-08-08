#!/usr/bin/env node
/**
 * Upload local save states and SRM files to R2.
 *
 * Walks {GAMES_DIR}/{system}/saves/{profileId}/ and uploads to:
 *   online-emu/saves/{profileId}/{system}/{filename}
 *   online-emu/srm/{profileId}/{system}/{filename}
 *
 * Usage:
 *   node scripts/migrate-saves-to-r2.js
 *   node scripts/migrate-saves-to-r2.js --root /data/games
 */

const fs = require("fs");
const path = require("path");
const {
	S3Client,
	PutObjectCommand,
	HeadObjectCommand,
} = require("@aws-sdk/client-s3");

function loadEnv() {
	const envPath = path.join(__dirname, "..", ".env");
	if (!fs.existsSync(envPath)) return;
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

async function exists(client, bucket, key) {
	try {
		await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
		return true;
	} catch {
		return false;
	}
}

async function uploadFile(client, bucket, localPath, key) {
	if (await exists(client, bucket, key)) {
		return "skipped";
	}
	const body = fs.readFileSync(localPath);
	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: "application/octet-stream",
		})
	);
	return "uploaded";
}

async function main() {
	loadEnv();

	const rootArg = process.argv.find((a) => a.startsWith("--root="));
	const gamesDir =
		(rootArg && rootArg.split("=")[1]) ||
		process.env.GAMES_DIR ||
		path.join(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "games");

	if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
		console.error("R2 credentials required");
		process.exit(1);
	}

	if (!fs.existsSync(gamesDir)) {
		console.log(`No games dir at ${gamesDir} — nothing to migrate`);
		return;
	}

	const client = new S3Client({
		region: "auto",
		endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: process.env.R2_ACCESS_KEY_ID,
			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
		},
	});
	const bucket = process.env.R2_BUCKET_NAME || "deejpotter";

	let uploaded = 0;
	let skipped = 0;

	const systems = fs.readdirSync(gamesDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);

	for (const system of systems) {
		const savesRoot = path.join(gamesDir, system, "saves");
		if (!fs.existsSync(savesRoot)) continue;

		const entries = fs.readdirSync(savesRoot, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const profileId = entry.name;
			const profileDir = path.join(savesRoot, profileId);
			const files = fs.readdirSync(profileDir);

			for (const file of files) {
				const localPath = path.join(profileDir, file);
				if (!fs.statSync(localPath).isFile()) continue;

				let key;
				if (file.endsWith(".srm")) {
					key = `online-emu/srm/${profileId}/${system}/${file}`;
				} else if (file.includes(".state")) {
					key = `online-emu/saves/${profileId}/${system}/${file}`;
				} else {
					continue;
				}

				const result = await uploadFile(client, bucket, localPath, key);
				if (result === "uploaded") uploaded++;
				else skipped++;
			}
		}
	}

	console.log(`Save migration complete: ${uploaded} uploaded, ${skipped} skipped`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
