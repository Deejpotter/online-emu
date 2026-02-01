/**
 * Virtual Controller Component
 *
 * A customizable on-screen gamepad overlay for touch controls.
 * Supports:
 * - D-Pad with 8-way input
 * - Action buttons (A, B, X, Y)
 * - Shoulder buttons (L, R)
 * - Start/Select buttons
 * - Analog stick (for N64/PS1)
 *
 * The controller adapts its layout based on the system being emulated.
 */

import React, { useCallback } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import DPad from "./DPad";
import ActionButtons from "./ActionButtons";
import ShoulderButtons from "./ShoulderButtons";
import MenuButtons from "./MenuButtons";

interface VirtualControllerProps {
	/** Called when a button is pressed down */
	onButtonPress: (button: string) => void;
	/** Called when a button is released */
	onButtonRelease: (button: string) => void;
	/** Called when analog stick moves (for systems with analog) */
	onAnalogMove?: (stick: "STICK_L" | "STICK_R", x: number, y: number) => void;
	/** The system being emulated - affects button layout */
	system?: string;
	/** Opacity of the controller overlay (0-1) */
	opacity?: number;
}

/**
 * Determines which buttons to show based on the system.
 */
function getSystemConfig(system: string) {
	switch (system) {
		case "nes":
		case "gb":
			// Simple 2-button controllers
			return {
				showXY: false,
				showShoulder: false,
				showAnalog: false,
				showZButtons: false,
			};
		case "snes":
		case "gba":
			// 4 face buttons + shoulders
			return {
				showXY: true,
				showShoulder: true,
				showAnalog: false,
				showZButtons: false,
			};
		case "n64":
			// Has analog stick and Z trigger
			return {
				showXY: false, // N64 has A, B only (plus C buttons which we map to X, Y)
				showShoulder: true,
				showAnalog: true,
				showZButtons: true,
			};
		case "psx":
			// Full controller with analog sticks
			return {
				showXY: true,
				showShoulder: true,
				showAnalog: true,
				showZButtons: true, // L2/R2
			};
		default:
			// Default to full controller
			return {
				showXY: true,
				showShoulder: true,
				showAnalog: false,
				showZButtons: false,
			};
	}
}

export default function VirtualController({
	onButtonPress,
	onButtonRelease,
	onAnalogMove,
	system = "snes",
	opacity = 0.7,
}: VirtualControllerProps) {
	const config = getSystemConfig(system);

	return (
		<View style={[styles.container, { opacity }]} pointerEvents="box-none">
			{/* Left side - D-Pad (and optionally analog stick) */}
			<View style={styles.leftSide}>
				<DPad onPress={onButtonPress} onRelease={onButtonRelease} />
			</View>

			{/* Center - Start/Select buttons */}
			<View style={styles.center}>
				<MenuButtons onPress={onButtonPress} onRelease={onButtonRelease} />
			</View>

			{/* Right side - Action buttons */}
			<View style={styles.rightSide}>
				<ActionButtons
					onPress={onButtonPress}
					onRelease={onButtonRelease}
					showXY={config.showXY}
				/>
			</View>

			{/* Top - Shoulder buttons */}
			{config.showShoulder && (
				<ShoulderButtons
					onPress={onButtonPress}
					onRelease={onButtonRelease}
					showZButtons={config.showZButtons}
				/>
			)}
		</View>
	);
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
	container: {
		...StyleSheet.absoluteFillObject,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		padding: 16,
	},
	leftSide: {
		justifyContent: "flex-end",
		paddingBottom: 20,
	},
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "flex-end",
		paddingBottom: 10,
	},
	rightSide: {
		justifyContent: "flex-end",
		paddingBottom: 20,
	},
});
