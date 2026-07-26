/**
 * Profile Storage Utilities
 *
 * Supports file-based storage (local dev) or Postgres (Coolify compose).
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Profile, CreateProfileRequest } from "@/types";
import { getPool, isPostgresEnabled } from "./db";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");

async function ensureDataDir(): Promise<void> {
	if (!existsSync(DATA_DIR)) {
		await mkdir(DATA_DIR, { recursive: true });
	}
}

function rowToProfile(row: {
	id: string;
	name: string;
	avatar: string;
	created_at: Date;
}): Profile {
	return {
		id: row.id,
		name: row.name,
		avatar: row.avatar,
		createdAt: row.created_at.toISOString(),
	};
}

async function getAllProfilesFile(): Promise<Profile[]> {
	try {
		await ensureDataDir();
		if (!existsSync(PROFILES_FILE)) {
			return [];
		}
		const raw = await readFile(PROFILES_FILE, "utf-8");
		const data = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
		return JSON.parse(data) as Profile[];
	} catch (error) {
		console.error("[Profiles] Error reading profiles:", error);
		return [];
	}
}

async function getAllProfilesPostgres(): Promise<Profile[]> {
	const result = await getPool().query(
		"SELECT id, name, avatar, created_at FROM profiles ORDER BY created_at ASC"
	);
	return result.rows.map(rowToProfile);
}

export async function getAllProfiles(): Promise<Profile[]> {
	if (isPostgresEnabled()) return getAllProfilesPostgres();
	return getAllProfilesFile();
}

export async function getProfileById(id: string): Promise<Profile | null> {
	if (isPostgresEnabled()) {
		const result = await getPool().query(
			"SELECT id, name, avatar, created_at FROM profiles WHERE id = $1",
			[id]
		);
		return result.rows[0] ? rowToProfile(result.rows[0]) : null;
	}
	const profiles = await getAllProfilesFile();
	return profiles.find((p) => p.id === id) || null;
}

export async function createProfile(
	data: CreateProfileRequest
): Promise<Profile> {
	const name = data.name.trim();
	if (!name) {
		throw new Error("Profile name cannot be empty");
	}

	if (isPostgresEnabled()) {
		const existing = await getPool().query(
			"SELECT id FROM profiles WHERE LOWER(name) = LOWER($1)",
			[name]
		);
		if (existing.rows.length > 0) {
			throw new Error("A profile with this name already exists");
		}

		const newProfile: Profile = {
			id: randomUUID(),
			name,
			avatar: data.avatar || "👤",
			createdAt: new Date().toISOString(),
		};

		await getPool().query(
			"INSERT INTO profiles (id, name, avatar, created_at) VALUES ($1, $2, $3, $4)",
			[newProfile.id, newProfile.name, newProfile.avatar, newProfile.createdAt]
		);
		return newProfile;
	}

	const profiles = await getAllProfilesFile();
	const existingName = profiles.find(
		(p) => p.name.toLowerCase() === name.toLowerCase()
	);
	if (existingName) {
		throw new Error("A profile with this name already exists");
	}

	const newProfile: Profile = {
		id: randomUUID(),
		name,
		avatar: data.avatar || "👤",
		createdAt: new Date().toISOString(),
	};

	profiles.push(newProfile);
	await saveProfilesFile(profiles);
	return newProfile;
}

export async function deleteProfile(id: string): Promise<boolean> {
	if (isPostgresEnabled()) {
		const result = await getPool().query(
			"DELETE FROM profiles WHERE id = $1 RETURNING id",
			[id]
		);
		return result.rowCount !== null && result.rowCount > 0;
	}

	const profiles = await getAllProfilesFile();
	const index = profiles.findIndex((p) => p.id === id);
	if (index === -1) return false;
	profiles.splice(index, 1);
	await saveProfilesFile(profiles);
	return true;
}

export async function updateProfile(
	id: string,
	data: Partial<CreateProfileRequest>
): Promise<Profile | null> {
	if (isPostgresEnabled()) {
		const current = await getProfileById(id);
		if (!current) return null;

		if (data.name) {
			const name = data.name.trim();
			if (!name) throw new Error("Profile name cannot be empty");
			const dup = await getPool().query(
				"SELECT id FROM profiles WHERE LOWER(name) = LOWER($1) AND id != $2",
				[name, id]
			);
			if (dup.rows.length > 0) {
				throw new Error("A profile with this name already exists");
			}
			current.name = name;
		}
		if (data.avatar) current.avatar = data.avatar;

		await getPool().query(
			"UPDATE profiles SET name = $1, avatar = $2 WHERE id = $3",
			[current.name, current.avatar || "👤", id]
		);
		return current;
	}

	const profiles = await getAllProfilesFile();
	const profile = profiles.find((p) => p.id === id);
	if (!profile) return null;

	if (data.name) {
		const name = data.name.trim();
		if (!name) throw new Error("Profile name cannot be empty");
		const existingName = profiles.find(
			(p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase()
		);
		if (existingName) {
			throw new Error("A profile with this name already exists");
		}
		profile.name = name;
	}
	if (data.avatar) profile.avatar = data.avatar;

	await saveProfilesFile(profiles);
	return profile;
}

async function saveProfilesFile(profiles: Profile[]): Promise<void> {
	await ensureDataDir();
	await writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8");
}
