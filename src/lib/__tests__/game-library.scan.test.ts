import fs from "fs/promises";
import path from "path";
import os from "os";

// We'll load the module AFTER setting process.env.GAMES_DIR so the internal const picks it up
describe("game-library scan & initialization (filesystem integration)", () => {
	const tmpRoot = path.join(os.tmpdir(), `online-emu-test-${Date.now()}`);
	const nesFolder = path.join(tmpRoot, "nes");
	const romsSub = path.join(nesFolder, "ROMs");
	const dataDir = path.join(tmpRoot, "data");
	const metadataPath = path.join(dataDir, "metadata.json");

	const unique = Date.now().toString(36);
	const testRomA = `test_game-${unique} (USA).nes`;
	const testRomB = `another-game-${unique}.nes`;

	beforeAll(async () => {
		await fs.mkdir(romsSub, { recursive: true });
		// write two unique fake ROM files
		await fs.writeFile(path.join(romsSub, testRomA), Buffer.from("ROM1"));
		await fs.writeFile(path.join(nesFolder, testRomB), Buffer.from("ROM2"));

		// point module at our temp games dir
		process.env.GAMES_DIR = tmpRoot;
		process.env.DATA_DIR = dataDir;
		jest.resetModules();
	});

	afterAll(async () => {
		// cleanup temp folder
		try {
			await fs.rm(tmpRoot, { recursive: true, force: true });
		} catch {}

		// remove any test entries from metadata.json that reference our temp paths
		try {
			const { loadGameLibrary, saveGameLibrary } = require("../game-library");
			const lib = await loadGameLibrary();
			const filtered = lib.games.filter(
				(g: any) => !g.romPath.startsWith("nes/")
			);
			if (filtered.length !== lib.games.length) {
				await saveGameLibrary({ ...lib, games: filtered });
			}
		} catch (e) {
			// ignore
		}

		// restore env
		delete process.env.GAMES_DIR;
		delete process.env.DATA_DIR;
		jest.resetModules();
	});

	test("initializeRomDirectory handles missing metadata by creating empty library", async () => {
		const {
			initializeRomDirectory,
			loadGameLibrary,
		} = require("../game-library");
		// remove metadata if present
		try {
			await fs.unlink(metadataPath);
		} catch {}
		await initializeRomDirectory();
		// metadata.json should exist with empty games
		await expect(fs.access(metadataPath)).resolves.toBeUndefined();
		const lib = await loadGameLibrary();
		expect(lib.games).toEqual([]);
	});

	test("scanForNewRoms discovers ROM files and creates entries", async () => {
		const { scanForNewRoms, loadGameLibrary } = require("../game-library");

		const before = await loadGameLibrary();
		const res = await scanForNewRoms();
		expect(res.added).toBeGreaterThanOrEqual(2);

		const after = await loadGameLibrary();
		// ensure that the two unique romPaths are present
		const hasTest = after.games.some((g: any) => g.romPath.includes(testRomA));
		const hasAnother = after.games.some((g: any) =>
			g.romPath.includes(testRomB)
		);
		expect(hasTest).toBe(true);
		expect(hasAnother).toBe(true);

		// cleanup: remove the entries we added
		const filtered = after.games.filter(
			(g: any) => !g.romPath.includes(testRomA) && !g.romPath.includes(testRomB)
		);
		await require("../game-library").saveGameLibrary({
			...after,
			games: filtered,
		});
	});

	test("loadGameLibrary returns empty if metadata is invalid", async () => {
		const { loadGameLibrary } = require("../game-library");
		// write invalid json
		await fs.writeFile(metadataPath, "not a json");
		const lib = await loadGameLibrary();
		expect(lib.games).toEqual([]);
	});

	test("scanForNewRoms handles readdir failure gracefully", async () => {
		// temporarily mock fs.readdir to throw
		const realReaddir = fs.readdir;
		(fs as any).readdir = async () => {
			throw new Error("boom");
		};
		const { scanForNewRoms } = require("../game-library");
		await expect(scanForNewRoms()).resolves.toMatchObject({ added: 0 });
		// restore
		(fs as any).readdir = realReaddir;
	});

	test("getSupportedSystems and getRomFullPath / getGamesDirectory", async () => {
		const {
			getSupportedSystems,
			getRomFullPath,
			getGamesDirectory,
		} = require("../game-library");
		const systems = getSupportedSystems();
		expect(systems).toContain("nes");

		expect(getGamesDirectory()).toBe(process.env.GAMES_DIR);
		expect(getRomFullPath("nes/ROMs/test_game.nes")).toBe(
			path.join(process.env.GAMES_DIR || "", "nes/ROMs/test_game.nes")
		);
	});
});
