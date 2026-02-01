/**
 * Profile Storage Utilities
 *
 * Server-side CRUD operations for user profiles.
 * Profiles are stored in /data/profiles.json as a simple JSON array.
 *
 * Why file-based storage:
 * - No database setup required for hobby project
 * - Easy to backup, edit, and version control
 * - Profiles are rarely modified (only on create/delete)
 * - Works offline without any external dependencies
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Profile, CreateProfileRequest } from "@/types";

// Path to profiles storage file (relative to server root)
const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");

/**
 * Ensure the data directory exists.
 */
async function ensureDataDir(): Promise<void> {
	if (!existsSync(DATA_DIR)) {
		await mkdir(DATA_DIR, { recursive: true });
	}
}

/**
 * Read all profiles from storage.
 * Returns empty array if file doesn't exist.
 */
export async function getAllProfiles(): Promise<Profile[]> {
	try {
		await ensureDataDir();
		if (!existsSync(PROFILES_FILE)) {
			return [];
		}
		const data = await readFile(PROFILES_FILE, "utf-8");
		return JSON.parse(data) as Profile[];
	} catch (error) {
		console.error("[Profiles] Error reading profiles:", error);
		return [];
	}
}

/**
 * Get a single profile by ID.
 * Returns null if not found.
 */
export async function getProfileById(id: string): Promise<Profile | null> {
	const profiles = await getAllProfiles();
	return profiles.find((p) => p.id === id) || null;
}

/**
 * Create a new profile.
 * Returns the created profile with generated ID and timestamp.
 */
export async function createProfile(
	data: CreateProfileRequest
): Promise<Profile> {
	const profiles = await getAllProfiles();

	// Validate name is not empty
	const name = data.name.trim();
	if (!name) {
		throw new Error("Profile name cannot be empty");
	}

	// Check for duplicate names (case-insensitive)
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
	await saveProfiles(profiles);

	return newProfile;
}

/**
 * Delete a profile by ID.
 * Returns true if deleted, false if not found.
 *
 * Note: This does NOT delete save files associated with the profile.
 * Save files are kept in case the user wants to recover them later.
 */
export async function deleteProfile(id: string): Promise<boolean> {
	const profiles = await getAllProfiles();
	const index = profiles.findIndex((p) => p.id === id);

	if (index === -1) {
		return false;
	}

	profiles.splice(index, 1);
	await saveProfiles(profiles);

	return true;
}

/**
 * Update a profile's name or avatar.
 * Returns the updated profile, or null if not found.
 */
export async function updateProfile(
	id: string,
	data: Partial<CreateProfileRequest>
): Promise<Profile | null> {
	const profiles = await getAllProfiles();
	const profile = profiles.find((p) => p.id === id);

	if (!profile) {
		return null;
	}

	if (data.name) {
		const name = data.name.trim();
		if (!name) {
			throw new Error("Profile name cannot be empty");
		}
		// Check for duplicate names (excluding current profile)
		const existingName = profiles.find(
			(p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase()
		);
		if (existingName) {
			throw new Error("A profile with this name already exists");
		}
		profile.name = name;
	}

	if (data.avatar) {
		profile.avatar = data.avatar;
	}

	await saveProfiles(profiles);
	return profile;
}

/**
 * Save profiles array to storage file.
 */
async function saveProfiles(profiles: Profile[]): Promise<void> {
	await ensureDataDir();
	await writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8");
}
