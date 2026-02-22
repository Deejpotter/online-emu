import { GET, POST, DELETE } from "../[gameId]/route";

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

test("POST/GET/DELETE SRM lifecycle (profile required)", async () => {
	const profile = "test-profile-1";
	const system = "gba";
	// POST without profile -> 401
	let res: any = await POST(makeReq(undefined, system, Buffer.from("data")), {
		params: Promise.resolve({ gameId: "test-game" }),
	});
	expect(res.status).toBe(401);

	// POST with profile
	res = await POST(makeReq(profile, system, Buffer.from("data")), {
		params: Promise.resolve({ gameId: "test-game" }),
	});
	const json = await res.json();
	expect(json.success).toBe(true);

	// GET with profile
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
