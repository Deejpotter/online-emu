/**
 * Save state and SRM storage abstraction.
 *
 * SAVE_STORAGE=r2  — Cloudflare R2 (Coolify production)
 * SAVE_STORAGE=local — filesystem under GAMES_DIR (local dev)
 */

import fs from "fs/promises";
import path from "path";
import { getGamesDirectory } from "./game-library";

export type SaveStorageBackend = "r2" | "local";

export function getSaveStorageBackend(): SaveStorageBackend {
	return process.env.SAVE_STORAGE === "r2" ? "r2" : "local";
}

async function r2() {
	return import("./r2-client");
}

function saveFileName(gameId: string, slot: string): string {
	return slot === "0" ? `${gameId}.state` : `${gameId}.state${slot}`;
}

function srmFileName(gameId: string): string {
	return `${gameId}.srm`;
}

function saveR2Key(
	profileId: string,
	system: string,
	gameId: string,
	slot: string
): string {
	return `online-emu/saves/${profileId}/${system}/${saveFileName(gameId, slot)}`;
}

function srmR2Key(profileId: string, system: string, gameId: string): string {
	return `online-emu/srm/${profileId}/${system}/${srmFileName(gameId)}`;
}

function profileSavePath(
	gamesDir: string,
	system: string,
	profileId: string,
	gameId: string,
	slot: string
): string {
	return path.join(
		gamesDir,
		system,
		"saves",
		profileId,
		saveFileName(gameId, slot)
	);
}

function legacySavePath(
	gamesDir: string,
	system: string,
	gameId: string,
	slot: string
): string {
	return path.join(gamesDir, system, "saves", saveFileName(gameId, slot));
}

function profileSrmPath(
	gamesDir: string,
	system: string,
	profileId: string,
	gameId: string
): string {
	return path.join(
		gamesDir,
		system,
		"saves",
		profileId,
		srmFileName(gameId)
	);
}

function legacySrmPath(
	gamesDir: string,
	system: string,
	gameId: string
): string {
	return path.join(gamesDir, system, "saves", srmFileName(gameId));
}

function assertWithinGamesDir(gamesDir: string, targetPath: string): void {
	const resolvedPath = path.resolve(targetPath);
	const resolvedGamesDir = path.resolve(gamesDir);
	if (!resolvedPath.startsWith(resolvedGamesDir)) {
		throw new Error("Invalid path");
	}
}

export async function getSaveState(
	profileId: string,
	system: string,
	gameId: string,
	slot: string
): Promise<{ data: Buffer; isLegacy: boolean } | null> {
	if (getSaveStorageBackend() === "r2") {
		const { fetchR2Object } = await r2();
		const data = await fetchR2Object(saveR2Key(profileId, system, gameId, slot));
		return data ? { data, isLegacy: false } : null;
	}

	const gamesDir = getGamesDirectory();
	const profilePath = profileSavePath(gamesDir, system, profileId, gameId, slot);
	assertWithinGamesDir(gamesDir, profilePath);

	let profileMissing = false;
	try {
		await fs.access(profilePath);
		const data = await fs.readFile(profilePath);
		return { data, isLegacy: false };
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			profileMissing = true;
		} else if (!profileMissing) {
			throw err;
		}
	}

	if (!profileMissing) {
		return null;
	}

	const legacyPath = legacySavePath(gamesDir, system, gameId, slot);
	assertWithinGamesDir(gamesDir, legacyPath);
	try {
		await fs.access(legacyPath);
		const data = await fs.readFile(legacyPath);
		return { data, isLegacy: true };
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw err;
	}
}

export async function putSaveState(
	profileId: string,
	system: string,
	gameId: string,
	slot: string,
	data: Buffer
): Promise<void> {
	if (getSaveStorageBackend() === "r2") {
		const { putR2Object } = await r2();
		await putR2Object(saveR2Key(profileId, system, gameId, slot), data);
		return;
	}

	const gamesDir = getGamesDirectory();
	const savePath = profileSavePath(gamesDir, system, profileId, gameId, slot);
	assertWithinGamesDir(gamesDir, savePath);
	await fs.mkdir(path.dirname(savePath), { recursive: true });
	await fs.writeFile(savePath, data);
}

export async function deleteSaveState(
	profileId: string,
	system: string,
	gameId: string,
	slot: string
): Promise<boolean> {
	if (getSaveStorageBackend() === "r2") {
		const { deleteR2Object } = await r2();
		return deleteR2Object(saveR2Key(profileId, system, gameId, slot));
	}

	const gamesDir = getGamesDirectory();
	const savePath = profileSavePath(gamesDir, system, profileId, gameId, slot);
	assertWithinGamesDir(gamesDir, savePath);
	try {
		await fs.unlink(savePath);
		return true;
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw err;
	}
}

export async function getSrm(
	profileId: string,
	system: string,
	gameId: string
): Promise<{ data: Buffer; isLegacy: boolean } | null> {
	if (getSaveStorageBackend() === "r2") {
		const { fetchR2Object } = await r2();
		const data = await fetchR2Object(srmR2Key(profileId, system, gameId));
		return data ? { data, isLegacy: false } : null;
	}

	const gamesDir = getGamesDirectory();
	const profilePath = profileSrmPath(gamesDir, system, profileId, gameId);
	assertWithinGamesDir(gamesDir, profilePath);

	try {
		await fs.access(profilePath);
		return { data: await fs.readFile(profilePath), isLegacy: false };
	} catch {
		const legacyPath = legacySrmPath(gamesDir, system, gameId);
		assertWithinGamesDir(gamesDir, legacyPath);
		try {
			await fs.access(legacyPath);
			return { data: await fs.readFile(legacyPath), isLegacy: true };
		} catch {
			return null;
		}
	}
}

export async function putSrm(
	profileId: string,
	system: string,
	gameId: string,
	data: Buffer
): Promise<void> {
	if (getSaveStorageBackend() === "r2") {
		const { putR2Object } = await r2();
		await putR2Object(srmR2Key(profileId, system, gameId), data);
		return;
	}

	const gamesDir = getGamesDirectory();
	const srmPath = profileSrmPath(gamesDir, system, profileId, gameId);
	assertWithinGamesDir(gamesDir, srmPath);
	await fs.mkdir(path.dirname(srmPath), { recursive: true });
	await fs.writeFile(srmPath, data);
}

export async function deleteSrm(
	profileId: string,
	system: string,
	gameId: string
): Promise<boolean> {
	if (getSaveStorageBackend() === "r2") {
		const { deleteR2Object } = await r2();
		return deleteR2Object(srmR2Key(profileId, system, gameId));
	}

	const gamesDir = getGamesDirectory();
	const srmPath = profileSrmPath(gamesDir, system, profileId, gameId);
	assertWithinGamesDir(gamesDir, srmPath);
	try {
		await fs.unlink(srmPath);
		return true;
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw err;
	}
}

export async function saveStateExists(
	profileId: string,
	system: string,
	gameId: string,
	slot: string
): Promise<boolean> {
	if (getSaveStorageBackend() === "r2") {
		const { headR2Object } = await r2();
		return headR2Object(saveR2Key(profileId, system, gameId, slot));
	}
	const result = await getSaveState(profileId, system, gameId, slot);
	return result !== null;
}
