/**
 * D-Pad Component
 *
 * A virtual directional pad supporting 8-way input.
 * Uses gesture detection to determine which direction(s) are pressed.
 * Supports simultaneous diagonal input (e.g., UP+RIGHT).
 */

import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface DPadProps {
	onPress: (button: string) => void;
	onRelease: (button: string) => void;
	size?: number;
}

/**
 * Determines which directions are pressed based on touch position.
 * Returns an array of direction strings.
 */
function getDirections(x: number, y: number, size: number): string[] {
	const directions: string[] = [];
	const center = size / 2;
	const deadzone = size * 0.15; // 15% center deadzone

	// Calculate distance from center
	const dx = x - center;
	const dy = y - center;

	// Check if outside deadzone
	if (Math.abs(dx) < deadzone && Math.abs(dy) < deadzone) {
		return [];
	}

	// Determine directions based on position
	// Using a circular model with 8 sectors
	const angle = Math.atan2(dy, dx) * (180 / Math.PI);

	// Convert angle to directions
	// Right: -45 to 45, Down: 45 to 135, Left: 135 to 180 or -180 to -135, Up: -135 to -45

	if (angle >= -67.5 && angle < 67.5) directions.push("RIGHT");
	if (angle >= 22.5 && angle < 157.5) directions.push("DOWN");
	if (angle >= 112.5 || angle < -112.5) directions.push("LEFT");
	if (angle >= -157.5 && angle < -22.5) directions.push("UP");

	return directions;
}

export default function DPad({ onPress, onRelease, size = 140 }: DPadProps) {
	const [activeDirections, setActiveDirections] = useState<Set<string>>(
		new Set()
	);

	// Animation values
	const scale = useSharedValue(1);
	const pressedUp = useSharedValue(0);
	const pressedDown = useSharedValue(0);
	const pressedLeft = useSharedValue(0);
	const pressedRight = useSharedValue(0);

	/**
	 * Handle touch/gesture updates.
	 */
	const handleTouch = useCallback(
		(x: number, y: number) => {
			const newDirections = new Set(getDirections(x, y, size));

			// Find newly pressed and released directions
			const pressed = [...newDirections].filter(
				(d) => !activeDirections.has(d)
			);
			const released = [...activeDirections].filter(
				(d) => !newDirections.has(d)
			);

			// Trigger callbacks
			pressed.forEach((dir) => {
				onPress(dir);
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			});
			released.forEach((dir) => onRelease(dir));

			// Update animation values
			pressedUp.value = withSpring(newDirections.has("UP") ? 1 : 0);
			pressedDown.value = withSpring(newDirections.has("DOWN") ? 1 : 0);
			pressedLeft.value = withSpring(newDirections.has("LEFT") ? 1 : 0);
			pressedRight.value = withSpring(newDirections.has("RIGHT") ? 1 : 0);

			setActiveDirections(newDirections);
		},
		[
			activeDirections,
			onPress,
			onRelease,
			size,
			pressedUp,
			pressedDown,
			pressedLeft,
			pressedRight,
		]
	);

	/**
	 * Handle touch end - release all directions.
	 */
	const handleTouchEnd = useCallback(() => {
		activeDirections.forEach((dir) => onRelease(dir));
		setActiveDirections(new Set());

		pressedUp.value = withSpring(0);
		pressedDown.value = withSpring(0);
		pressedLeft.value = withSpring(0);
		pressedRight.value = withSpring(0);
		scale.value = withSpring(1);
	}, [
		activeDirections,
		onRelease,
		scale,
		pressedUp,
		pressedDown,
		pressedLeft,
		pressedRight,
	]);

	// Pan gesture for tracking touch position
	const panGesture = Gesture.Pan()
		.onBegin((event) => {
			scale.value = withSpring(0.95);
			handleTouch(event.x, event.y);
		})
		.onUpdate((event) => {
			handleTouch(event.x, event.y);
		})
		.onEnd(() => {
			handleTouchEnd();
		})
		.onFinalize(() => {
			handleTouchEnd();
		});

	// Animated styles for each direction
	const upStyle = useAnimatedStyle(() => ({
		opacity: 0.3 + pressedUp.value * 0.5,
		transform: [{ scale: 1 + pressedUp.value * 0.1 }],
	}));

	const downStyle = useAnimatedStyle(() => ({
		opacity: 0.3 + pressedDown.value * 0.5,
		transform: [{ scale: 1 + pressedDown.value * 0.1 }],
	}));

	const leftStyle = useAnimatedStyle(() => ({
		opacity: 0.3 + pressedLeft.value * 0.5,
		transform: [{ scale: 1 + pressedLeft.value * 0.1 }],
	}));

	const rightStyle = useAnimatedStyle(() => ({
		opacity: 0.3 + pressedRight.value * 0.5,
		transform: [{ scale: 1 + pressedRight.value * 0.1 }],
	}));

	const containerStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	return (
		<GestureDetector gesture={panGesture}>
			<Animated.View
				style={[
					styles.container,
					{ width: size, height: size },
					containerStyle,
				]}
			>
				{/* Background circle */}
				<View style={styles.background} />

				{/* Direction indicators */}
				<Animated.View style={[styles.direction, styles.up, upStyle]}>
					<View style={styles.arrow} />
				</Animated.View>
				<Animated.View style={[styles.direction, styles.down, downStyle]}>
					<View style={[styles.arrow, { transform: [{ rotate: "180deg" }] }]} />
				</Animated.View>
				<Animated.View style={[styles.direction, styles.left, leftStyle]}>
					<View style={[styles.arrow, { transform: [{ rotate: "-90deg" }] }]} />
				</Animated.View>
				<Animated.View style={[styles.direction, styles.right, rightStyle]}>
					<View style={[styles.arrow, { transform: [{ rotate: "90deg" }] }]} />
				</Animated.View>

				{/* Center dot */}
				<View style={styles.centerDot} />
			</Animated.View>
		</GestureDetector>
	);
}

const styles = StyleSheet.create({
	container: {
		justifyContent: "center",
		alignItems: "center",
	},
	background: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(255, 255, 255, 0.1)",
		borderRadius: 70,
		borderWidth: 2,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	direction: {
		position: "absolute",
		width: 40,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
	},
	up: {
		top: 5,
	},
	down: {
		bottom: 5,
	},
	left: {
		left: 5,
	},
	right: {
		right: 5,
	},
	arrow: {
		width: 0,
		height: 0,
		backgroundColor: "transparent",
		borderStyle: "solid",
		borderLeftWidth: 12,
		borderRightWidth: 12,
		borderBottomWidth: 18,
		borderLeftColor: "transparent",
		borderRightColor: "transparent",
		borderBottomColor: "rgba(255, 255, 255, 0.8)",
	},
	centerDot: {
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: "rgba(255, 255, 255, 0.3)",
	},
});
