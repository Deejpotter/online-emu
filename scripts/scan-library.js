#!/usr/bin/env node
/**
 * Scan GAMES_DIR for ROMs, update data/metadata.json, and prune to supported systems.
 *
 * Usage:
 *   node scripts/scan-library.js
 *   node scripts/scan-library.js --prune-only   # skip scan, only filter metadata
 */

const fs = require("fs");
const path = require("path");
require("tsx/cjs");

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

const KEEP = new Set(["nes", "snes", "gb", "gba", "n64"]);
const METADATA_PATH = path.join(__dirname, "..", "data", "metadata.json");
const pruneOnly = process.argv.includes("--prune-only");

async function main() {
	if (!pruneOnly) {
		process.env.DATA_DIR = path.join(__dirname, "..", "data");
		const { initializeRomDirectory, scanForNewRoms } = require("../src/lib/game-library");
		await initializeRomDirectory();
		const { added, total } = await scanForNewRoms();
		console.log(`Scan complete: ${total} games (${added} new)`);
	}

	if (!fs.existsSync(METADATA_PATH)) {
		console.error(`Metadata not found: ${METADATA_PATH}`);
		process.exit(1);
	}

	const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, "utf8"));
	const before = metadata.games?.length ?? 0;
	metadata.games = (metadata.games || []).filter((g) => KEEP.has(g.system));
	metadata.lastUpdated = new Date().toISOString();
	fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
	console.log(`Pruned metadata: kept ${metadata.games.length} of ${before} games`);
}

main().catch((e) => {
	console.error("FATAL", e);
	process.exit(1);
});
