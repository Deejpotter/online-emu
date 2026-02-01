/**
 * Menu Buttons Component
 *
 * Start and Select buttons, positioned in the center bottom area.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

interface MenuButtonsProps {
	onPress: (button: string) => void;
	onRelease: (button: string) => void;
}

interface MenuButtonProps {
	label: string;
	onPressIn: () => void;
	onPressOut: () => void;
}

/**
 * Individual menu button (small, pill-shaped).
 */
function MenuButton({ label, onPressIn, onPressOut }: MenuButtonProps) {
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
				{
					backgroundColor: pressed
						? "rgba(255, 255, 255, 0.3)"
						: "rgba(255, 255, 255, 0.15)",
					transform: [{ scale: pressed ? 0.95 : 1 }],
				},
			]}
		>
			<Text style={styles.buttonLabel}>{label}</Text>
		</Pressable>
	);
}

export default function MenuButtons({ onPress, onRelease }: MenuButtonsProps) {
	return (
		<View style={styles.container}>
			<MenuButton
				label="SELECT"
				onPressIn={() => onPress("SELECT")}
				onPressOut={() => onRelease("SELECT")}
			/>
			<MenuButton
				label="START"
				onPressIn={() => onPress("START")}
				onPressOut={() => onRelease("START")}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		gap: 16,
	},
	button: {
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	buttonLabel: {
		color: "#fff",
		fontSize: 10,
		fontWeight: "bold",
		letterSpacing: 1,
	},
});
