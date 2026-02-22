import { loadGameLibrary, saveGameLibrary } from "../game-library";

test("load and save game library metadata", async () => {
	const lib = await loadGameLibrary();
	expect(lib).toHaveProperty("games");
	// round-trip save
	await saveGameLibrary(lib);
	const lib2 = await loadGameLibrary();
	expect(lib2.lastUpdated).toBeDefined();
});
