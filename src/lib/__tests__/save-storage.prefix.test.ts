const mockPut = jest.fn().mockResolvedValue(undefined);
jest.mock("../r2-client", () => ({
	putR2Object: (...args: unknown[]) => mockPut(...args),
}));

import { putSaveState, putSrm } from "../save-storage";

describe("save-storage R2 key prefix", () => {
	const original = { ...process.env };

	beforeEach(() => {
		mockPut.mockClear();
		process.env.SAVE_STORAGE = "r2";
		delete process.env.R2_SAVE_PREFIX;
	});

	afterAll(() => {
		process.env = original;
	});

	test("production keys are unchanged when no prefix is set", async () => {
		await putSaveState("p1", "nes", "Zelda", "0", Buffer.from("x"));
		await putSrm("p1", "nes", "Zelda", Buffer.from("y"));
		expect(mockPut.mock.calls[0][0]).toMatch(/^online-emu\/saves\/p1\/nes\//);
		expect(mockPut.mock.calls[1][0]).toMatch(/^online-emu\/srm\/p1\/nes\//);
	});

	test("staging writes under its own prefix", async () => {
		process.env.R2_SAVE_PREFIX = "online-emu-staging/";
		await putSaveState("p1", "nes", "Zelda", "0", Buffer.from("x"));
		await putSrm("p1", "nes", "Zelda", Buffer.from("y"));
		expect(mockPut.mock.calls[0][0]).toMatch(/^online-emu-staging\/saves\//);
		expect(mockPut.mock.calls[1][0]).toMatch(/^online-emu-staging\/srm\//);
	});
});
