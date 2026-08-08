#!/usr/bin/env node
/**
 * Verify R2-first deployment prerequisites:
 * - R2 credentials configured
 * - library/manifest.json exists and lists supported systems only
 * - Sample ROM keys exist under roms/
 *
 * Usage:
 *   node scripts/verify-r2-flow.js
 *   LIBRARY_SOURCE=r2 node scripts/verify-r2-flow.js --local   # also test ensureLibrary seed
 */

const fs = require("fs");
const path = require("path");
require("tsx/cjs");
const { S3Client, GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

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
const MANIFEST_KEY = "library/manifest.json";
const KEEP = new Set(["nes", "snes", "gb", "gba", "n64"]);
const SAMPLE_SIZE = 5;
const testLocal = process.argv.includes("--local");

function requireEnv(name) {
	if (!process.env[name]) {
		console.error(`Missing env: ${name}`);
		process.exit(1);
	}
}

requireEnv("R2_ACCOUNT_ID");
requireEnv("R2_ACCESS_KEY_ID");
requireEnv("R2_SECRET_ACCESS_KEY");

const client = new S3Client({
	region: "auto",
	endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
	},
});

async function headRom(key) {
	try {
		const res = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
		return { ok: true, size: res.ContentLength ?? 0 };
	} catch (err) {
		if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
			return { ok: false };
		}
		throw err;
	}
}

(async () => {
	let failures = 0;
	const pass = (msg) => console.log(`  OK  ${msg}`);
	const fail = (msg) => {
		console.log(` FAIL ${msg}`);
		failures++;
	};

	console.log("\nR2 flow verification\n");

	const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: MANIFEST_KEY }));
	const chunks = [];
	for await (const chunk of res.Body) chunks.push(chunk);
	const manifest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	const games = manifest.games || [];

	pass(`manifest fetched (${games.length} games)`);

	const badSystems = [...new Set(games.map((g) => g.system).filter((s) => !KEEP.has(s)))];
	if (badSystems.length === 0) {
		pass("manifest uses only supported systems");
	} else {
		fail(`unsupported systems in manifest: ${badSystems.join(", ")}`);
	}

	const sample = games.slice(0, SAMPLE_SIZE);
	let romHits = 0;
	for (const game of sample) {
		const key = `roms/${game.romPath.replace(/\\/g, "/")}`;
		const head = await headRom(key);
		if (head.ok) {
			romHits++;
			pass(`ROM exists: ${key} (${head.size} bytes)`);
		} else {
			fail(`ROM missing: ${key}`);
		}
	}

	if (romHits === sample.length) {
		pass(`all ${SAMPLE_SIZE} sample ROMs present in R2`);
	}

	if (testLocal) {
		const dataDir = path.join(__dirname, "..", "data", ".verify-r2");
		const metadataPath = path.join(dataDir, "metadata.json");
		fs.rmSync(dataDir, { recursive: true, force: true });
		fs.mkdirSync(dataDir, { recursive: true });
		process.env.DATA_DIR = dataDir;
		process.env.LIBRARY_SOURCE = "r2";

		const { ensureLibrary } = require("../src/lib/library-source");
		await ensureLibrary();

		if (fs.existsSync(metadataPath)) {
			const local = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
			if ((local.games || []).length > 0) {
				pass(`ensureLibrary seeded ${local.games.length} games locally`);
			} else {
				fail("ensureLibrary wrote empty metadata");
			}
		} else {
			fail("ensureLibrary did not create metadata.json");
		}

		// Exercise ROM API against live R2
		const { GET } = require("../src/app/api/roms/[...path]/route");
		const sampleGame = games[0];
		const segments = sampleGame.romPath.replace(/\\/g, "/").split("/");
		const req = { nextUrl: new URL(`http://localhost/api/roms/${segments.map(encodeURIComponent).join("/")}`) };
		const romRes = await GET(req, { params: Promise.resolve({ path: segments }) });
		if (romRes.status === 200 && romRes.headers.get("X-ROM-Source") === "r2") {
			pass(`ROM API served ${sampleGame.romPath} from R2`);
		} else {
			fail(`ROM API failed for ${sampleGame.romPath} (status ${romRes.status})`);
		}

		// Exercise games library read
		process.env.DATA_DIR = dataDir;
		const { getAllGames } = require("../src/lib/game-library");
		const allGames = await getAllGames();
		if (allGames.length > 0) {
			pass(`game library lists ${allGames.length} games`);
		} else {
			fail("game library empty after seed");
		}

		fs.rmSync(dataDir, { recursive: true, force: true });
	}

	console.log("");
	if (failures === 0) {
		console.log("All checks passed.");
		process.exit(0);
	}
	console.log(`${failures} check(s) failed.`);
	process.exit(1);
})().catch((e) => {
	console.error("FATAL", e.message);
	process.exit(1);
});
