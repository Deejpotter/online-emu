/** @jest-environment node */
const { verifyDeploy } = require("../../../scripts/verify-deploy.js");

type Route = { status: number; type?: string; body?: string; location?: string };

function fakeFetch(routes: Record<string, Route>) {
	return async (url: string) => {
		const route = routes[new URL(url).pathname] || { status: 404 };
		const headers = new Headers();
		if (route.type) headers.set("content-type", route.type);
		if (route.location) headers.set("location", route.location);
		return new Response(route.body ?? "", { status: route.status, headers });
	};
}

const healthy: Record<string, Route> = {
	"/api/status": { status: 200, type: "application/json", body: '{"success":true}' },
	"/emulator.html": { status: 200, type: "text/html; charset=utf-8", body: "<html>v2</html>" },
	"/save-guard.js": { status: 200, type: "application/javascript" },
	"/emulatorjs/data/loader.js": { status: 200, type: "application/javascript" },
	"/sw.js": { status: 200, type: "application/javascript" },
};

describe("verify-deploy", () => {
	test("passes a healthy, up-to-date deploy", async () => {
		const { ok } = await verifyDeploy("https://example.test/", {
			fetch: fakeFetch(healthy),
			expectedEmulatorHtml: "<html>v2</html>",
		});
		expect(ok).toBe(true);
	});

	test("fails when a player asset is redirected to /profiles", async () => {
		const { ok, results } = await verifyDeploy("https://example.test", {
			fetch: fakeFetch({
				...healthy,
				"/save-guard.js": { status: 307, location: "/profiles?redirect=%2Fsave-guard.js" },
			}),
		});
		expect(ok).toBe(false);
		expect(results.find((r: { name: string }) => r.name === "/save-guard.js").detail).toMatch(/redirected/);
	});

	test("fails when the live player page is an older version", async () => {
		const { ok } = await verifyDeploy("https://example.test", {
			fetch: fakeFetch(healthy),
			expectedEmulatorHtml: "<html>v3</html>",
		});
		expect(ok).toBe(false);
	});

	test("fails when the status endpoint is down", async () => {
		const { ok } = await verifyDeploy("https://example.test", {
			fetch: fakeFetch({ ...healthy, "/api/status": { status: 530 } }),
		});
		expect(ok).toBe(false);
	});
});
