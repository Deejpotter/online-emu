/**
 * Root Layout for the OnlineEmu Mobile App
 *
 * Sets up:
 * - Gesture handler root view (required for touch controls)
 * - Dark theme
 * - Navigation stack
 */

import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";

export default function RootLayout() {
	return (
		<GestureHandlerRootView style={styles.container}>
			<StatusBar style="light" />
			<Stack
				screenOptions={{
					headerStyle: {
						backgroundColor: "#1a1a2e",
					},
					headerTintColor: "#fff",
					headerTitleStyle: {
						fontWeight: "bold",
					},
					contentStyle: {
						backgroundColor: "#0f0f1a",
					},
				}}
			>
				<Stack.Screen
					name="index"
					options={{
						title: "OnlineEmu",
						headerShown: true,
					}}
				/>
				<Stack.Screen
					name="games"
					options={{
						title: "Select Game",
					}}
				/>
				<Stack.Screen
					name="play"
					options={{
						// Hide header during gameplay for full-screen experience
						headerShown: false,
					}}
				/>
			</Stack>
		</GestureHandlerRootView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#0f0f1a",
	},
});
