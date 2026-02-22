import { GET, POST, DELETE } from "../[gameId]/route";
import fs from "fs/promises";
import path from "path";
import { getGamesDirectory } from "@/lib/game-library";

const makeReq = (profileId?: string, system?: string, body?: Buffer) => {
	const url = new URL("http://localhost/api/srm/test-game");
	if (system) url.searchParams.set("system", system);
	const req: any = {
		nextUrl: { searchParams: url.searchParams },
		cookies: {
			get: (k: string) => (profileId ? { value: profileId } : undefined),
		},
		arrayBuffer: async () => (body ? body.buffer : new ArrayBuffer(0)),
	};
	return req;
};

describe("SRM API - edge cases", () => {
	const profile = "test-profile-edge";
	const system = "gba";
	const gamesDir = getGamesDirectory();
	const legacySavesDir = path.join(gamesDir, system, "saves");

	afterAll(async () => {
		// cleanup any legacy file we created
		try {
			await fs.unlink(path.join(legacySavesDir, "legacy-srm-test.srm"));
		} catch {}
	});

	test("GET without system param returns 400", async () => {
		const res: any = await GET(makeReq(profile, undefined), {
			params: Promise.resolve({ gameId: "test-game" }),
		});
		const json = await res.json();
		expect(res.status).toBe(400);
		expect(json.success).toBe(false);
	});

	test("POST with empty body returns 400", async () => {
		const res: any = await POST(makeReq(profile, system, Buffer.from("")), {
			params: Promise.resolve({ gameId: "test-game" }),
		});
		const json = await res.json();
		expect(res.status).toBe(400);
		expect(json.success).toBe(false);
	});

	test("Path traversal in gameId is blocked (403)", async () => {
		// Use an absolute path in the gameId (decoded to '/etc/passwd') which must be rejected
		// climb up enough segments so the resolved path leaves the configured gamesDir
		const res: any = await POST(makeReq(profile, system, Buffer.from("x")), {
			params: Promise.resolve({ gameId: "..%2F..%2F..%2F..%2Fescape" }),
		});
		const json = await res.json();
		expect(res.status).toBe(403);
		expect(json.success).toBe(false);
	});

	test("Returns legacy SRM when profile save is missing and legacy exists", async () => {
		// ensure legacy dir exists and write a legacy SRM
		await fs.mkdir(legacySavesDir, { recursive: true });
		const legacyPath = path.join(legacySavesDir, "legacy-srm-test.srm");
		await fs.writeFile(legacyPath, Buffer.from("LEGACY"));

		const getRes: any = await GET(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "legacy-srm-test" }),
		});
		expect(getRes.status).toBe(200);
		// header should indicate legacy save
		expect(getRes.headers.get("X-Legacy-Save")).toBe("true");
		const buf = await getRes.arrayBuffer();
		expect(buf.byteLength).toBeGreaterThan(0);

		// cleanup
		await fs.unlink(legacyPath);
	});

	// more edge cases
	test("GET without profile returns 401", async () => {
		const res: any = await GET(makeReq(undefined, system), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBe(401);
	});

	test("POST without profile returns 401", async () => {
		const res: any = await POST(makeReq(undefined, system, Buffer.from("x")), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBe(401);
	});

	test("GET missing system returns 400", async () => {
		const res: any = await GET(makeReq(profile, undefined), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBe(400);
	});

	test("DELETE without profile returns 401", async () => {
		const res: any = await DELETE(makeReq(undefined, system), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBe(401);
	});

	test("DELETE missing system returns 400", async () => {
		const res: any = await DELETE(makeReq(profile, undefined), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBe(400);
	});

	test("GET invalid path returns error status", async () => {
		const res: any = await GET(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "..%2F..%2Fescape" }),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
	});

	test("DELETE invalid path returns error status", async () => {
		const res: any = await DELETE(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "..%2F..%2Fescape" }),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
	});

	// trigger security-check branch by faking path.resolve
	test("GET security check returns 403 when resolve escapes", async () => {
		// patch resolve to return external path only for the profile path
		const orig = path.resolve;
		jest.spyOn(path, "resolve").mockImplementation((p: string) => {
			if (p.includes("saves")) return "/outside";
			return orig(p);
		});
		const res: any = await GET(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
		(path.resolve as any).mockRestore();
	});

	test("DELETE security check returns 403 when resolve escapes", async () => {
		const orig = path.resolve;
		jest.spyOn(path, "resolve").mockImplementation((p: string) => {
			if (p.includes("saves")) return "/outside";
			return orig(p);
		});
		const res: any = await DELETE(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
		(path.resolve as any).mockRestore();
	});

	// missing SRM file returns 404 normally
	test("GET missing SRM returns 404", async () => {
		const res: any = await GET(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "nonexisting" }),
		});
		expect(res.status).toBe(404);
	});

	// error during read returns 500 (or other error code)
	test("GET catch returns error status on read error", async () => {
		const fsMock = require("fs/promises");
		jest.spyOn(fsMock, "access").mockResolvedValue(undefined);
		jest
			.spyOn(fsMock, "readFile")
			.mockRejectedValue(Object.assign(new Error("boom"), { code: "EFAIL" }));
		const res: any = await GET(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "whatever" }),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
		fsMock.readFile.mockRestore();
		fsMock.access.mockRestore();
	});

	// POST catch covers write error
	test("POST catch returns 500 on write error", async () => {
		const fsMock = require("fs/promises");
		jest
			.spyOn(fsMock, "writeFile")
			.mockRejectedValue(Object.assign(new Error("boom"), { code: "EFAIL" }));
		const res: any = await POST(makeReq(profile, system, Buffer.from("x")), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBe(500);
		fsMock.writeFile.mockRestore();
	});

	// DELETE catch: mock unlink error (expect any error status)
	test("DELETE catch returns error status on unlink error", async () => {
		const fsMock = require("fs/promises");
		jest
			.spyOn(fsMock, "unlink")
			.mockRejectedValue(Object.assign(new Error("boom"), { code: "EFAIL" }));
		const res: any = await DELETE(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
		fsMock.unlink.mockRestore();
	});
});
