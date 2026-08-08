import fs from "fs/promises";
import path from "path";
import os from "os";
import {
	getSaveState,
	putSaveState,
	deleteSaveState,
	getSaveStorageBackend,
} from "../save-storage";

describe("save-storage (local backend)", () => {
	let tempDir: string;
	const profileId = "profile-1";
	const system = "gba";
	const gameId = "Test Game";

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "save-storage-"));
		process.env.GAMES_DIR = tempDir;
		process.env.SAVE_STORAGE = "local";
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test("defaults to local backend in tests", () => {
		expect(getSaveStorageBackend()).toBe("local");
	});

	test("put/get/delete save state lifecycle", async () => {
		const data = Buffer.from("save-bytes");
		await putSaveState(profileId, system, gameId, "0", data);

		const loaded = await getSaveState(profileId, system, gameId, "0");
		expect(loaded?.data.toString()).toBe("save-bytes");
		expect(loaded?.isLegacy).toBe(false);

		const deleted = await deleteSaveState(profileId, system, gameId, "0");
		expect(deleted).toBe(true);

		const missing = await getSaveState(profileId, system, gameId, "0");
		expect(missing).toBeNull();
	});
});
