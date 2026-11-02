/** @jest-environment node */
import fs from "fs";
import path from "path";
import { CONTROL_LAYOUT, KEYBOARD_MAP, FAST_FORWARD_CODE, controlsHint, toEmulatorJSControls } from "@/lib/controls";

describe("shared keyboard layout", () => {
	test("uses EmulatorJS button slots (A=8, B=0, Select=2, Start=3)", () => {
		const slot = (b: string) => CONTROL_LAYOUT.find((c) => c.button === b)!.index;
		expect([slot("a"), slot("b"), slot("select"), slot("start")]).toEqual([8, 0, 2, 3]);
	});

	test("no key or slot is bound twice, and Space stays free for fast-forward", () => {
		const codes = CONTROL_LAYOUT.flatMap((c) => c.codes);
		expect(new Set(codes).size).toBe(codes.length);
		expect(new Set(CONTROL_LAYOUT.map((c) => c.index)).size).toBe(CONTROL_LAYOUT.length);
		expect(codes).not.toContain(FAST_FORWARD_CODE);
		expect(KEYBOARD_MAP.Space).toBeUndefined();
	});

	test("EmulatorJS gets Shift for Select and the matching keys for player 1", () => {
		const p1 = toEmulatorJSControls()[0];
		expect(p1[2]).toEqual({ value: "shift", value2: "SELECT" });
		expect(p1[8].value).toBe("x");
		expect(p1[0].value).toBe("z");
	});

	test("hint text comes from the same layout", () => {
		const hint = controlsHint();
		expect(hint).toContain("X = A");
		expect(hint).toContain("Shift = Select");
		expect(hint).toContain("Space = Fast-forward");
	});

	test("the emulator page loads the shared layout before its own script", () => {
		const html = fs.readFileSync(path.join(__dirname, "../../../public/emulator.html"), "utf8");
		const controlsTag = html.indexOf('<script src="/controls.js"></script>');
		expect(controlsTag).toBeGreaterThan(-1);
		expect(controlsTag).toBeLessThan(html.indexOf("<script>"));
		expect(html).toContain("window.EJS_defaultControls = window.EmuControls.toEmulatorJSControls()");
	});
});
