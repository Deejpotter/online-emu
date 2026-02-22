import { GET, POST, DELETE } from "../[gameId]/route";
import fs from "fs/promises";
import path from "path";
import { getGamesDirectory } from "@/lib/game-library";

const makeReq = (profileId?: string, system?: string, body?: Buffer) => {
	const url = new URL("http://localhost/api/saves/test-game");
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

describe("Save-state API - edge cases", () => {
	const profile = "test-profile-edge";
	const system = "nes";
	const gamesDir = getGamesDirectory();
	const legacySavesDir = path.join(gamesDir, system, "saves");

	afterAll(async () => {
		try {
			await fs.unlink(path.join(legacySavesDir, "legacy-save-test.state"));
		} catch {}
	});

	test("POST with empty body returns 400", async () => {
		const res: any = await POST(
			makeReq(profile, system, new TextEncoder().encode("")),
			{ params: Promise.resolve({ gameId: "test-game" }) }
		);
		const json = await res.json();
		expect(res.status).toBe(400);
		expect(json.success).toBe(false);
	});

	test("Path traversal in gameId is blocked (403)", async () => {
		// Use an absolute path in the gameId (decoded to '/etc/passwd') which must be rejected
		// climb up enough segments so the resolved path leaves the configured gamesDir
		const res: any = await POST(
			makeReq(profile, system, new TextEncoder().encode("x")),
			{ params: Promise.resolve({ gameId: "..%2F..%2F..%2F..%2Fescape" }) }
		);
		const json = await res.json();
		expect(res.status).toBe(403);
		expect(json.success).toBe(false);
	});

	test("GET returns legacy save with X-Legacy-Save header when profile save missing", async () => {
		await fs.mkdir(legacySavesDir, { recursive: true });
		const legacyPath = path.join(legacySavesDir, "legacy-save-test.state");
		await fs.writeFile(legacyPath, Buffer.from("LEGACY"));

		const getRes: any = await GET(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "legacy-save-test" }),
		});
		expect(getRes.status).toBe(200);
		expect(getRes.headers.get("X-Legacy-Save")).toBe("true");
		const buf = await getRes.arrayBuffer();
		expect(buf.byteLength).toBeGreaterThan(0);

		await fs.unlink(legacyPath);
	});

	test("DELETE non-existent save returns 404", async () => {
		const delRes: any = await DELETE(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "nonexistent" }),
		});
		const json = await delRes.json();
		expect(delRes.status).toBe(404);
		expect(json.success).toBe(false);
	});

	// additional GET/DELETE edge cases
	test("GET without profile returns 401", async () => {
		const res: any = await GET(makeReq(undefined, system), {
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

	test("GET invalid path returns an error status", async () => {
		const res: any = await GET(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "..%2F..%2Fescape" }),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
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

	test("DELETE invalid path returns an error status", async () => {
		const res: any = await DELETE(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "..%2F..%2Fescape" }),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
	});

	test("POST error path logs and returns 500", async () => {
		// simulate write error by mocking fs.writeFile
		const fsMock = require("fs/promises");
		jest.spyOn(fsMock, "writeFile").mockRejectedValue(new Error("disk full"));
		const res: any = await POST(
			makeReq(profile, system, new TextEncoder().encode("state")),
			{ params: Promise.resolve({ gameId: "test-game" }) }
		);
		expect(res.status).toBe(500);
		const json = await res.json();
		expect(json.error).toContain("Failed to save");
		fsMock.writeFile.mockRestore();
	});

	test("POST without profile returns 401", async () => {
		const res: any = await POST(
			makeReq(undefined, system, new TextEncoder().encode("x")),
			{ params: Promise.resolve({ gameId: "test-game" }) }
		);
		expect(res.status).toBe(401);
	});

	test("POST missing system returns 400", async () => {
		const res: any = await POST(
			makeReq(profile, undefined, new TextEncoder().encode("x")),
			{ params: Promise.resolve({ gameId: "test-game" }) }
		);
		expect(res.status).toBe(400);
	});

	test("GET catch returns 500 on read error", async () => {
		const fsMock = require("fs/promises");
		jest.spyOn(fsMock, "access").mockResolvedValue(undefined);
		jest.spyOn(fsMock, "readFile").mockRejectedValue(new Error("boom"));
		const res: any = await GET(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "whatever" }),
		});
		expect(res.status).toBe(500);
		fsMock.readFile.mockRestore();
		fsMock.access.mockRestore();
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
		expect(res.status).toBe(403);
		(path.resolve as any).mockRestore();
	});

	test("DELETE catch returns 500 on unlink error", async () => {
		const fsMock = require("fs/promises");
		jest
			.spyOn(fsMock, "unlink")
			.mockRejectedValue(Object.assign(new Error("boom"), { code: "EFAIL" }));
		const res: any = await DELETE(makeReq(profile, system), {
			params: Promise.resolve({ gameId: "foo" }),
		});
		expect(res.status).toBe(500);
		fsMock.unlink.mockRestore();
	});
});
