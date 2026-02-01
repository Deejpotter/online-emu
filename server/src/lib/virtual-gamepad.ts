/**
 * Virtual Gamepad Service
 *
 * Creates and manages virtual Xbox 360 controllers using ViGEmBus.
 * These virtual controllers receive inputs from the mobile app via Socket.IO
 * and inject them at the OS level, allowing any game/emulator to use them.
 *
 * Prerequisites:
 * - ViGEmBus driver must be installed: https://github.com/ViGEm/ViGEmBus/releases
 * - Windows only (ViGEm is Windows-specific)
 *
 * The service creates one virtual controller per active session.
 * Inputs from the phone are mapped to Xbox 360 controller buttons/axes.
 */

// Import types - actual vigemclient import is dynamic to avoid crashes on non-Windows
import type { ControllerButton, AnalogInput, InputEvent } from "@/types";

// Type definitions for vigemclient (not installed yet, will be optional)
interface ViGEmController {
	button: Record<string, { setValue: (value: boolean) => void }>;
	axis: Record<string, { setValue: (value: number) => void }>;
	connect: (opts?: { vendorID?: number; productID?: number }) => Error | null;
	disconnect: () => Error | null;
	update: () => void;
	updateMode: "auto" | "manual";
}

interface ViGEmClientType {
	connect: () => Error | null;
	createX360Controller: () => ViGEmController;
}

// Singleton ViGEm client instance
let vigemClient: ViGEmClientType | null = null;
let isViGEmAvailable = false;

// Map of session ID to virtual controller
const activeControllers = new Map<string, ViGEmController>();

/**
 * Button mapping from our controller buttons to Xbox 360 buttons.
 * ViGEmClient uses uppercase button names.
 */
const BUTTON_MAP: Record<ControllerButton, string | null> = {
	// Face buttons
	A: "A",
	B: "B",
	X: "X",
	Y: "Y",
	// D-Pad (handled via axes, not buttons)
	UP: null,
	DOWN: null,
	LEFT: null,
	RIGHT: null,
	// Meta buttons
	START: "START",
	SELECT: "BACK",
	// Shoulder buttons
	L: "LEFT_SHOULDER",
	R: "RIGHT_SHOULDER",
	L2: null, // Handled as axis (left trigger)
	R2: null, // Handled as axis (right trigger)
	// Stick buttons
	L3: "LEFT_THUMB",
	R3: "RIGHT_THUMB",
	// Analog sticks (not buttons)
	STICK_L: null,
	STICK_R: null,
};

/**
 * Initialize the ViGEm client.
 * This should be called once at server startup.
 * Returns true if ViGEm is available, false otherwise.
 */
export async function initializeViGEm(): Promise<boolean> {
	if (vigemClient) {
		return isViGEmAvailable;
	}

	try {
		// Dynamic import to avoid crashes if not installed
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const vigemModule = await import("vigemclient" as any);
		const ViGEmClient = vigemModule.default;

		vigemClient = new ViGEmClient();
		const connectError = vigemClient?.connect();

		if (connectError) {
			console.error(
				"[VirtualGamepad] Failed to connect to ViGEmBus:",
				connectError.message
			);
			console.log("[VirtualGamepad] Make sure ViGEmBus driver is installed.");
			console.log(
				"[VirtualGamepad] Download from: https://github.com/ViGEm/ViGEmBus/releases"
			);
			vigemClient = null;
			isViGEmAvailable = false;
			return false;
		}

		console.log("[VirtualGamepad] Connected to ViGEmBus driver");
		isViGEmAvailable = true;
		return true;
	} catch {
		console.log(
			"[VirtualGamepad] vigemclient not installed or ViGEmBus not available"
		);
		console.log(
			"[VirtualGamepad] External emulator controller support disabled"
		);
		console.log("[VirtualGamepad] To enable, run: npm install vigemclient");
		isViGEmAvailable = false;
		return false;
	}
}

/**
 * Check if virtual gamepad support is available.
 */
export function isVirtualGamepadAvailable(): boolean {
	return isViGEmAvailable;
}

/**
 * Create a virtual controller for a session.
 * Returns the controller or null if ViGEm is not available.
 */
export function createVirtualController(
	sessionId: string
): ViGEmController | null {
	if (!vigemClient || !isViGEmAvailable) {
		console.log(
			"[VirtualGamepad] Cannot create controller - ViGEm not available"
		);
		return null;
	}

	// Check if controller already exists for this session
	if (activeControllers.has(sessionId)) {
		return activeControllers.get(sessionId)!;
	}

	try {
		const controller = vigemClient.createX360Controller();
		const error = controller.connect();

		if (error) {
			console.error(
				`[VirtualGamepad] Failed to connect controller for session ${sessionId}:`,
				error.message
			);
			return null;
		}

		// Use manual update mode for better performance when setting multiple values
		controller.updateMode = "manual";

		activeControllers.set(sessionId, controller);
		console.log(
			`[VirtualGamepad] Created virtual controller for session ${sessionId}`
		);

		return controller;
	} catch (error) {
		console.error("[VirtualGamepad] Error creating controller:", error);
		return null;
	}
}

/**
 * Destroy a virtual controller for a session.
 */
export function destroyVirtualController(sessionId: string): void {
	const controller = activeControllers.get(sessionId);
	if (controller) {
		try {
			controller.disconnect();
			console.log(
				`[VirtualGamepad] Destroyed controller for session ${sessionId}`
			);
		} catch (error) {
			console.error("[VirtualGamepad] Error disconnecting controller:", error);
		}
		activeControllers.delete(sessionId);
	}
}

/**
 * Handle a button input event from the mobile app.
 */
export function handleButtonInput(sessionId: string, input: InputEvent): void {
	const controller = activeControllers.get(sessionId);
	if (!controller) return;

	const { button, pressed } = input;

	// Handle D-Pad via axes
	if (button === "UP" || button === "DOWN") {
		let value = 0;
		if (button === "UP" && pressed) value = -1;
		if (button === "DOWN" && pressed) value = 1;
		controller.axis.dpadVert.setValue(value);
		controller.update();
		return;
	}

	if (button === "LEFT" || button === "RIGHT") {
		let value = 0;
		if (button === "LEFT" && pressed) value = -1;
		if (button === "RIGHT" && pressed) value = 1;
		controller.axis.dpadHorz.setValue(value);
		controller.update();
		return;
	}

	// Handle triggers as axes
	if (button === "L2") {
		controller.axis.leftTrigger.setValue(pressed ? 1 : 0);
		controller.update();
		return;
	}

	if (button === "R2") {
		controller.axis.rightTrigger.setValue(pressed ? 1 : 0);
		controller.update();
		return;
	}

	// Handle regular buttons
	const xboxButton = BUTTON_MAP[button];
	if (xboxButton && controller.button[xboxButton]) {
		controller.button[xboxButton].setValue(pressed);
		controller.update();
	}
}

/**
 * Handle analog stick input from the mobile app.
 */
export function handleAnalogInput(sessionId: string, input: AnalogInput): void {
	const controller = activeControllers.get(sessionId);
	if (!controller) return;

	const { stick, x, y } = input;

	if (stick === "STICK_L") {
		controller.axis.leftX.setValue(x);
		controller.axis.leftY.setValue(-y); // Y is inverted on Xbox controllers
	} else if (stick === "STICK_R") {
		controller.axis.rightX.setValue(x);
		controller.axis.rightY.setValue(-y);
	}

	controller.update();
}

/**
 * Reset all inputs on a controller to neutral state.
 */
export function resetController(sessionId: string): void {
	const controller = activeControllers.get(sessionId);
	if (!controller) return;

	// Reset all buttons
	for (const buttonName of Object.values(BUTTON_MAP)) {
		if (buttonName && controller.button[buttonName]) {
			controller.button[buttonName].setValue(false);
		}
	}

	// Reset all axes to neutral
	controller.axis.leftX.setValue(0);
	controller.axis.leftY.setValue(0);
	controller.axis.rightX.setValue(0);
	controller.axis.rightY.setValue(0);
	controller.axis.leftTrigger.setValue(0);
	controller.axis.rightTrigger.setValue(0);
	controller.axis.dpadHorz.setValue(0);
	controller.axis.dpadVert.setValue(0);

	controller.update();
}

/**
 * Get the number of active virtual controllers.
 */
export function getActiveControllerCount(): number {
	return activeControllers.size;
}

/**
 * Cleanup all controllers (called on server shutdown).
 */
export function cleanupAllControllers(): void {
	for (const sessionId of activeControllers.keys()) {
		destroyVirtualController(sessionId);
	}
	console.log("[VirtualGamepad] All controllers cleaned up");
}
