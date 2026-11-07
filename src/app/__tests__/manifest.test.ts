import fs from "fs";
import path from "path";
import manifest from "../manifest";

describe("web app manifest", () => {
	const m = manifest();

	it("has the fields an installed app needs", () => {
		expect(m).toMatchObject({
			name: "Online Emulator",
			short_name: "OnlineEmu",
			start_url: "/",
			display: "standalone",
		});
		expect(m.description).toBeTruthy();
		expect(m.background_color).toBeTruthy();
		expect(m.theme_color).toBeTruthy();
	});

	it("lists 192 and 512 icons plus a 512 maskable icon", () => {
		const icons = m.icons ?? [];
		expect(icons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sizes: "192x192", purpose: "any" }),
				expect.objectContaining({ sizes: "512x512", purpose: "any" }),
				expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
			]),
		);
	});

	it("only points at icons that exist in public/", () => {
		for (const icon of m.icons ?? []) {
			expect(fs.existsSync(path.join(process.cwd(), "public", icon.src))).toBe(true);
		}
	});
});
