import { GET } from "../[...path]/route";
import { fetchR2Object } from "@/lib/r2-client";
import { getGamesDirectory } from "@/lib/game-library";
import fs from "fs/promises";
import path from "path";
import os from "os";

jest.mock("@/lib/r2-client", () => ({
	fetchR2Object: jest.fn(),
}));

jest.mock("@/lib/game-library", () => ({
	getGamesDirectory: jest.fn(),
}));

const mockFetchR2 = fetchR2Object as jest.MockedFunction<typeof fetchR2Object>;
const mockGetGamesDirectory = getGamesDirectory as jest.MockedFunction<
	typeof getGamesDirectory
>;

function makeRequest(segments: string[]) {
	const url = `http://localhost/api/roms/${segments.map(encodeURIComponent).join("/")}`;
	return { nextUrl: new URL(url) } as any;
}

describe("ROMs API", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roms-api-"));
		mockGetGamesDirectory.mockReturnValue(tempDir);
		mockFetchR2.mockReset();
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test("returns ROM from R2 with X-ROM-Source header", async () => {
		mockFetchR2.mockResolvedValue(Buffer.from("rom-data"));

		const res = await GET(makeRequest(["GB", "ROMs", "test.zip"]), {
			params: Promise.resolve({ path: ["GB", "ROMs", "test.zip"] }),
		});

		expect(res.status).toBe(200);
		expect(res.headers.get("X-ROM-Source")).toBe("r2");
		expect(mockFetchR2).toHaveBeenCalledWith("roms/GB/ROMs/test.zip");
	});

	test("falls back to local file when R2 miss", async () => {
		mockFetchR2.mockResolvedValue(null);
		const romDir = path.join(tempDir, "nes", "ROMs");
		await fs.mkdir(romDir, { recursive: true });
		await fs.writeFile(path.join(romDir, "local.nes"), Buffer.from("local-rom"));

		const res = await GET(makeRequest(["nes", "ROMs", "local.nes"]), {
			params: Promise.resolve({ path: ["nes", "ROMs", "local.nes"] }),
		});

		expect(res.status).toBe(200);
		expect(res.headers.get("X-ROM-Source")).toBe("local");
		expect(res.headers.get("Content-Length")).toBe("9");
	});

	test("blocks path traversal", async () => {
		mockFetchR2.mockResolvedValue(null);

		const res = await GET(makeRequest(["..", "..", "etc", "passwd"]), {
			params: Promise.resolve({ path: ["..", "..", "etc", "passwd"] }),
		});

		expect(res.status).toBe(403);
	});

	test("returns 404 when ROM missing everywhere", async () => {
		mockFetchR2.mockResolvedValue(null);

		const res = await GET(makeRequest(["nes", "ROMs", "missing.nes"]), {
			params: Promise.resolve({ path: ["nes", "ROMs", "missing.nes"] }),
		});

		expect(res.status).toBe(404);
	});
});
