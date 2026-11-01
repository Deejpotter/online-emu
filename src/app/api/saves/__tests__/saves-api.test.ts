/** @jest-environment node */
jest.mock("@/lib/profiles", () => ({ profileExists: async (id: string) => id !== "ghost" }));
import { GET, POST, DELETE } from "../[gameId]/route";

const makeReq = (profileId?: string, system?: string, body?: ArrayBuffer | Uint8Array) => {
	const url = new URL("http://localhost/api/saves/test-game");
	if (system) url.searchParams.set("system", system);
	const req: any = {
		nextUrl: { searchParams: url.searchParams },
		cookies: {
			get: () => (profileId ? { value: profileId } : undefined),
		},
		arrayBuffer: async () => body || new ArrayBuffer(0),
	};
	return req;
};

test("POST/GET/DELETE save-state lifecycle (profile required)", async () => {
	const profile = "test-profile-1";
	const system = "gba";

	// POST with profile
	const res: any = await POST(
		makeReq(profile, system, new TextEncoder().encode("state")),
		{ params: Promise.resolve({ gameId: "test-game" }) }
	);
	const json = await res.json();
	expect(json.success).toBe(true);

	// GET
	const getRes: any = await GET(makeReq(profile, system), {
		params: Promise.resolve({ gameId: "test-game" }),
	});
	expect(getRes.status).toBe(200);
	const buf = await getRes.arrayBuffer();
	expect(buf.byteLength).toBeGreaterThan(0);

	// DELETE
	const delRes: any = await DELETE(makeReq(profile, system), {
		params: Promise.resolve({ gameId: "test-game" }),
	});
	const djson = await delRes.json();
	expect(djson.success).toBe(true);
});

test("rejects a profile id that doesn't exist", async () => {
	const ctx = { params: Promise.resolve({ gameId: "test-game" }) };
	const post: any = await POST(makeReq("ghost", "gba", new TextEncoder().encode("x")), ctx);
	expect(post.status).toBe(401);
	const get: any = await GET(makeReq("ghost", "gba"), { params: Promise.resolve({ gameId: "test-game" }) });
	expect(get.status).toBe(401);
	const del: any = await DELETE(makeReq("ghost", "gba"), { params: Promise.resolve({ gameId: "test-game" }) });
	expect(del.status).toBe(401);
});
