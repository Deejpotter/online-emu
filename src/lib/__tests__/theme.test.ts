/** @jest-environment node */
import fs from "fs";
import path from "path";

const css = fs.readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");

describe("global theme", () => {
	test("never switches to light colours (the UI is dark-only)", () => {
		expect(css).not.toMatch(/prefers-color-scheme/);
		expect(css).toMatch(/color-scheme:\s*dark/);
	});

	test("default text colour is light", () => {
		const fg = css.match(/--foreground:\s*#([0-9a-f]{6})/i);
		expect(fg).not.toBeNull();
		const [r, g, b] = [0, 2, 4].map((i) => parseInt(fg![1].slice(i, i + 2), 16));
		// Perceived brightness well above mid-grey
		expect(0.299 * r + 0.587 * g + 0.114 * b).toBeGreaterThan(200);
	});
});
