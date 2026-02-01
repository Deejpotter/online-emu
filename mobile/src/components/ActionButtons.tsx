/**
 * Action Buttons Component
 *
 * The face buttons on the right side of the controller.
 * Classic diamond layout: A (right), B (bottom), X (top), Y (left)
 * For NES/GB, only A and B are shown.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

interface ActionButtonsProps {
	onPress: (button: string) => void;
	onRelease: (button: string) => void;
	/** Whether to show X and Y buttons (false for NES/GB) */
	showXY?: boolean;
	size?: number;
}

interface ButtonProps {
	label: string;
	color: string;
	onPressIn: () => void;
	onPressOut: () => void;
	size: number;
}

/**
 * Individual action button with visual feedback.
 */
function ActionButton({
	label,
	color,
	onPressIn,
	onPressOut,
	size,
}: ButtonProps) {
	const handlePressIn = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		onPressIn();
	};

	return (
		<Pressable
			onPressIn={handlePressIn}
			onPressOut={onPressOut}
			style={({ pressed }) => [
				styles.button,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: pressed ? color : `${color}88`,
					transform: [{ scale: pressed ? 0.9 : 1 }],
				},
			]}
		>
			<Text style={styles.buttonLabel}>{label}</Text>
		</Pressable>
	);
}

export default function ActionButtons({
	onPress,
	onRelease,
	showXY = true,
	size = 50,
}: ActionButtonsProps) {
	// Container size based on button size
	const containerSize = showXY ? size * 3 : size * 2.2;

	return (
		<View
			style={[
				styles.container,
				{ width: containerSize, height: containerSize },
			]}
		>
			{/* A button - right position (green like Xbox/Nintendo) */}
			<View style={[styles.buttonPosition, styles.aPosition]}>
				<ActionButton
					label="A"
					color="#22c55e"
					onPressIn={() => onPress("A")}
					onPressOut={() => onRelease("A")}
					size={size}
				/>
			</View>

			{/* B button - bottom position (red) */}
			<View style={[styles.buttonPosition, styles.bPosition]}>
				<ActionButton
					label="B"
					color="#ef4444"
					onPressIn={() => onPress("B")}
					onPressOut={() => onRelease("B")}
					size={size}
				/>
			</View>

			{showXY && (
				<>
					{/* X button - top position (blue) */}
					<View style={[styles.buttonPosition, styles.xPosition]}>
						<ActionButton
							label="X"
							color="#3b82f6"
							onPressIn={() => onPress("X")}
							onPressOut={() => onRelease("X")}
							size={size}
						/>
					</View>

					{/* Y button - left position (yellow) */}
					<View style={[styles.buttonPosition, styles.yPosition]}>
						<ActionButton
							label="Y"
							color="#eab308"
							onPressIn={() => onPress("Y")}
							onPressOut={() => onRelease("Y")}
							size={size}
						/>
					</View>
				</>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		position: "relative",
	},
	buttonPosition: {
		position: "absolute",
	},
	// Diamond layout positions
	aPosition: {
		right: 0,
		top: "50%",
		transform: [{ translateY: -25 }],
	},
	bPosition: {
		bottom: 0,
		left: "50%",
		transform: [{ translateX: -25 }],
	},
	xPosition: {
		top: 0,
		left: "50%",
		transform: [{ translateX: -25 }],
	},
	yPosition: {
		left: 0,
		top: "50%",
		transform: [{ translateY: -25 }],
	},
	button: {
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 2,
		borderColor: "rgba(255, 255, 255, 0.3)",
	},
	buttonLabel: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "bold",
	},
});
