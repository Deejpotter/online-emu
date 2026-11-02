/**
 * Keyboard layout for the player, shared by the emulator page (EmulatorJS
 * controls) and the play page (hint text and key forwarding), so the two
 * can't drift apart.
 *
 * `index` is the EmulatorJS/libretro button slot, `key` the EmulatorJS key
 * name, `codes` the KeyboardEvent.code values, and `pad` the gamepad
 * binding EmulatorJS ships by default.
 */
(function (root, factory) {
	if (typeof module === "object" && module.exports) {
		module.exports = factory();
	} else {
		root.EmuControls = factory();
	}
})(typeof self !== "undefined" ? self : this, function () {
	// Bump when LAYOUT changes so saved per-game mappings are replaced once
	const CONTROLS_VERSION = 2;

	const LAYOUT = [
		{ button: "up", label: "Up", index: 4, key: "up arrow", codes: ["ArrowUp"], pad: "DPAD_UP" },
		{ button: "down", label: "Down", index: 5, key: "down arrow", codes: ["ArrowDown"], pad: "DPAD_DOWN" },
		{ button: "left", label: "Left", index: 6, key: "left arrow", codes: ["ArrowLeft"], pad: "DPAD_LEFT" },
		{ button: "right", label: "Right", index: 7, key: "right arrow", codes: ["ArrowRight"], pad: "DPAD_RIGHT" },
		{ button: "a", label: "A", index: 8, key: "x", codes: ["KeyX"], pad: "BUTTON_1" },
		{ button: "b", label: "B", index: 0, key: "z", codes: ["KeyZ"], pad: "BUTTON_2" },
		{ button: "x", label: "X", index: 9, key: "s", codes: ["KeyS"], pad: "BUTTON_3" },
		{ button: "y", label: "Y", index: 1, key: "a", codes: ["KeyA"], pad: "BUTTON_4" },
		{ button: "l", label: "L", index: 10, key: "q", codes: ["KeyQ"], pad: "LEFT_TOP_SHOULDER" },
		{ button: "r", label: "R", index: 11, key: "w", codes: ["KeyW"], pad: "RIGHT_TOP_SHOULDER" },
		{ button: "start", label: "Start", index: 3, key: "enter", codes: ["Enter"], pad: "START" },
		{ button: "select", label: "Select", index: 2, key: "shift", codes: ["ShiftLeft", "ShiftRight"], pad: "SELECT" },
	];

	/** Key that toggles fast-forward (handled by our pages, not by EmulatorJS) */
	const FAST_FORWARD_CODE = "Space";

	/** EmulatorJS `defaultControllers` shape: player 1 bound, players 2 to 4 empty */
	function toEmulatorJSControls() {
		const player = {};
		for (const entry of LAYOUT) player[entry.index] = { value: entry.key, value2: entry.pad };
		player[12] = { value: "", value2: "LEFT_BOTTOM_SHOULDER" };
		player[13] = { value: "", value2: "RIGHT_BOTTOM_SHOULDER" };
		return { 0: player, 1: {}, 2: {}, 3: {} };
	}

	/** KeyboardEvent.code to our button name, for forwarding keys from the parent page */
	function toKeyboardMap() {
		const map = {};
		for (const entry of LAYOUT) for (const code of entry.codes) map[code] = entry.button;
		return map;
	}

	return { CONTROLS_VERSION, LAYOUT, FAST_FORWARD_CODE, toEmulatorJSControls, toKeyboardMap };
});
