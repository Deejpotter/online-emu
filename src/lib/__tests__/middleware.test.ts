/** @jest-environment node */
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const visit = (path: string) => middleware(new NextRequest(new URL(path, "http://localhost")));
const isRedirectToProfiles = (res: Response) =>
	res.status >= 300 && res.status < 400 && (res.headers.get("location") || "").includes("/profiles");

describe("middleware", () => {
	test.each(["/emulator.html", "/save-guard.js", "/emulatorjs/data/loader.js", "/sw.js"])(
		"serves emulator asset %s without a profile",
		(path) => {
			expect(isRedirectToProfiles(visit(path))).toBe(false);
		}
	);

	test("sends pages to profile selection when no profile is chosen", () => {
		expect(isRedirectToProfiles(visit("/play?id=x"))).toBe(true);
	});
});
