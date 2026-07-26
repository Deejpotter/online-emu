#!/usr/bin/env node
/**
 * Migrate profiles from profiles.json into Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate-profiles-to-postgres.js
 *   node scripts/migrate-profiles-to-postgres.js --file /data/profiles.json
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

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

async function main() {
	loadEnv();

	const fileArg = process.argv.find((a) => a.startsWith("--file="));
	const profilesFile =
		(fileArg && fileArg.split("=")[1]) ||
		process.env.PROFILES_FILE ||
		path.join(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "profiles.json");

	if (!process.env.DATABASE_URL) {
		console.error("DATABASE_URL is required");
		process.exit(1);
	}

	if (!fs.existsSync(profilesFile)) {
		console.log(`No profiles file at ${profilesFile} — nothing to migrate`);
		return;
	}

	const raw = fs.readFileSync(profilesFile, "utf8");
	const data = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
	const profiles = JSON.parse(data);

	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	const migrationPath = path.join(__dirname, "..", "src/lib/db/migrations/001_profiles.sql");
	await pool.query(fs.readFileSync(migrationPath, "utf8"));

	let inserted = 0;
	let skipped = 0;

	for (const p of profiles) {
		const result = await pool.query(
			`INSERT INTO profiles (id, name, avatar, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
			[p.id, p.name, p.avatar || "👤", p.createdAt || new Date().toISOString()]
		);
		if (result.rowCount > 0) inserted++;
		else skipped++;
	}

	await pool.end();
	console.log(`Migrated ${inserted} profiles (${skipped} already existed) from ${profilesFile}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
