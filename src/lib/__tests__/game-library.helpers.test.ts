import {
	loadGameLibrary,
	saveGameLibrary,
	markGameAsPlayed,
	updateGame,
	deleteGame,
	filenameToTitle,
} from "../game-library";

const testGame = {
	id: "test-helper-game-1",
	title: "Helper Test",
	system: "nes" as const,
	romPath: "nes/ROMs/helper.nes",
	fileSize: 123,
	playCount: 0,
};

describe("game-library helpers", () => {
	afterEach(async () => {
		// remove test game if it exists
		const lib = await loadGameLibrary();
		const filtered = lib.games.filter((g) => g.id !== testGame.id);
		if (filtered.length !== lib.games.length) {
			await saveGameLibrary({ ...lib, games: filtered });
		}
	});

	test("markGameAsPlayed returns null when game missing", async () => {
		expect(await markGameAsPlayed("no-such-id")).toBeNull();
	});

	test("markGameAsPlayed increments playCount and sets lastPlayed", async () => {
		const lib = await loadGameLibrary();
		lib.games.push(testGame as any);
		await saveGameLibrary(lib);

		const updated = await markGameAsPlayed(testGame.id);
		expect(updated).not.toBeNull();
		expect(updated!.playCount).toBeGreaterThanOrEqual(1);
		expect(updated!.lastPlayed).toBeDefined();
	});

	test("updateGame returns null for unknown id and updates known", async () => {
		const unknown = await updateGame("no-such-id", { title: "x" });
		expect(unknown).toBeNull();

		const lib = await loadGameLibrary();
		lib.games.push(testGame as any);
		await saveGameLibrary(lib);

		const changed = await updateGame(testGame.id, { title: "New Title" });
		expect(changed).not.toBeNull();
		expect(changed!.title).toBe("New Title");
	});

	test("deleteGame returns false for missing and true when present", async () => {
		const lib = await loadGameLibrary();
		const before = lib.games.length;
		// ensure missing id returns false
		expect(await deleteGame("no-id")).toBe(false);

		// add a dummy game and then delete it
		lib.games.push({
			id: "to-delete",
			title: "Delete Me",
			system: "nes",
			romPath: "nes/foo",
			fileSize: 1,
			playCount: 0,
		} as any);
		await saveGameLibrary(lib);

		expect(await deleteGame("to-delete")).toBe(true);
	});

	test("filenameToTitle handles underscores, tags and casing", () => {
		expect(filenameToTitle("super_mario-usa (USA).nes")).toBe(
			"Super Mario Usa"
		);
		expect(filenameToTitle("zelda_[hacks]-final.sfc")).toBe("Zelda Final");
	});

	test("getAllGames, getGamesBySystem, getGameById helpers", async () => {
		const {
			getAllGames,
			getGamesBySystem,
			getGameById,
		} = require("../game-library");
		const lib = await loadGameLibrary();
		// ensure we have at least one game
		lib.games.push(testGame as any);
		await saveGameLibrary(lib);

		const all = await getAllGames();
		expect(all).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: testGame.id })])
		);

		const bySystem = await getGamesBySystem("nes");
		expect(bySystem.some((g: any) => g.id === testGame.id)).toBe(true);

		const single = await getGameById(testGame.id);
		expect(single?.id).toBe(testGame.id);
	});
});
