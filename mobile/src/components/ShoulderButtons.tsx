/**
 * Shoulder Buttons Component
 *
 * L/R buttons at the top of the screen.
 * Optionally shows L2/R2 (or Z buttons for N64).
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

interface ShoulderButtonsProps {
	onPress: (button: string) => void;
	onRelease: (button: string) => void;
	/** Whether to show L2/R2 (Z) buttons */
	showZButtons?: boolean;
}

interface ShoulderButtonProps {
	label: string;
	onPressIn: () => void;
	onPressOut: () => void;
	isWide?: boolean;
}

/**
 * Individual shoulder button.
 */
function ShoulderButton({
	label,
	onPressIn,
	onPressOut,
	isWide = false,
}: ShoulderButtonProps) {
	const handlePressIn = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		onPressIn();
	};

	return (
		<Pressable
			onPressIn={handlePressIn}
			onPressOut={onPressOut}
			style={({ pressed }) => [
				styles.button,
				isWide && styles.buttonWide,
				{
					backgroundColor: pressed
						? "rgba(99, 102, 241, 0.8)"
						: "rgba(99, 102, 241, 0.4)",
					transform: [{ scale: pressed ? 0.95 : 1 }],
				},
			]}
		>
			<Text style={styles.buttonLabel}>{label}</Text>
		</Pressable>
	);
}

export default function ShoulderButtons({
	onPress,
	onRelease,
	showZButtons = false,
}: ShoulderButtonsProps) {
	return (
		<View style={styles.container}>
			{/* Left shoulder buttons */}
			<View style={styles.side}>
				{showZButtons && (
					<ShoulderButton
						label="L2"
						onPressIn={() => onPress("L2")}
						onPressOut={() => onRelease("L2")}
					/>
				)}
				<ShoulderButton
					label="L"
					onPressIn={() => onPress("L")}
					onPressOut={() => onRelease("L")}
					isWide
				/>
			</View>

			{/* Right shoulder buttons */}
			<View style={styles.side}>
				<ShoulderButton
					label="R"
					onPressIn={() => onPress("R")}
					onPressOut={() => onRelease("R")}
					isWide
				/>
				{showZButtons && (
					<ShoulderButton
						label="R2"
						onPressIn={() => onPress("R2")}
						onPressOut={() => onRelease("R2")}
					/>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		top: 16,
		left: 16,
		right: 16,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	side: {
		flexDirection: "row",
		gap: 8,
	},
	button: {
		paddingVertical: 12,
		paddingHorizontal: 24,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	buttonWide: {
		paddingHorizontal: 32,
	},
	buttonLabel: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "bold",
	},
});
