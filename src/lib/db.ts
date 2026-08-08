/**
 * Postgres connection pool and schema migrations.
 */

import { readFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";

let pool: Pool | null = null;

export function isPostgresEnabled(): boolean {
	return process.env.PROFILE_STORAGE === "postgres" && !!process.env.DATABASE_URL;
}

export function getPool(): Pool {
	if (!isPostgresEnabled()) {
		throw new Error("Postgres is not configured (PROFILE_STORAGE=postgres + DATABASE_URL)");
	}
	if (!pool) {
		pool = new Pool({ connectionString: process.env.DATABASE_URL });
	}
	return pool;
}

export async function runMigrations(): Promise<void> {
	if (!isPostgresEnabled()) return;

	const migrationPath = path.join(
		process.cwd(),
		"src/lib/db/migrations/001_profiles.sql"
	);
	const sql = await readFile(migrationPath, "utf8");
	const db = getPool();
	await db.query(sql);
	console.log("[DB] Migrations applied");
}

export async function closePool(): Promise<void> {
	if (pool) {
		await pool.end();
		pool = null;
	}
}
