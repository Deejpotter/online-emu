/**
 * Typed access to the player's keyboard layout. The layout itself lives in
 * public/controls.js so the emulator page (plain HTML) can load it too.
 */
import emuControls from "../../public/controls.js";

export interface ControlEntry {
	button: string;
	label: string;
	index: number;
	key: string;
	codes: string[];
	pad: string;
}

interface EmuControls {
	CONTROLS_VERSION: number;
	LAYOUT: ControlEntry[];
	FAST_FORWARD_CODE: string;
	toEmulatorJSControls(): Record<number, Record<number, { value: string; value2: string }>>;
	toKeyboardMap(): Record<string, string>;
}

const controls = emuControls as unknown as EmuControls;

export const CONTROL_LAYOUT = controls.LAYOUT;
export const FAST_FORWARD_CODE = controls.FAST_FORWARD_CODE;
export const KEYBOARD_MAP = controls.toKeyboardMap();
export const toEmulatorJSControls = controls.toEmulatorJSControls;

/** Key names shown to players, e.g. "ArrowUp" -> "↑", "KeyX" -> "X" */
function keyLabel(code: string): string {
	const arrows: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
	if (arrows[code]) return arrows[code];
	if (code.startsWith("Key")) return code.slice(3);
	if (code.startsWith("Shift")) return "Shift";
	return code;
}

/** One-line hint for the play page, built from the same layout the emulator uses */
export function controlsHint(): string {
	const dpad = "Arrows = D-Pad";
	const buttons = CONTROL_LAYOUT.filter((c) => !["up", "down", "left", "right"].includes(c.button)).map(
		(c) => `${keyLabel(c.codes[0])} = ${c.label}`
	);
	return [dpad, ...buttons, "Space = Fast-forward"].join(", ");
}
