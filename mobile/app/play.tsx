/**
 * Play Screen
 *
 * The main gameplay screen that displays:
 * - Video stream from the server (via WebRTC)
 * - Virtual controller overlay
 *
 * This is a "thin client" - all emulation happens on the PC.
 * We just display the video and send controller inputs.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	Dimensions,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { io, Socket } from "socket.io-client";
import { RTCView, MediaStream } from "react-native-webrtc";
import VirtualController from "../src/components/VirtualController";
import { WebRTCService, createWebRTCService } from "../src/services/webrtc";

/**
 * Connection states for the play screen.
 */
type ConnectionState =
	| "connecting"
	| "waiting"
	| "streaming"
	| "playing"
	| "error"
	| "disconnected";

export default function PlayScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		host: string;
		port: string;
		sessionId: string;
		gameTitle: string;
		gameSystem: string;
	}>();

	const [connectionState, setConnectionState] =
		useState<ConnectionState>("connecting");
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [streamURL, setStreamURL] = useState<string | null>(null);

	const socketRef = useRef<Socket | null>(null);
	const webrtcRef = useRef<WebRTCService | null>(null);

	const serverUrl = `http://${params.host}:${params.port}`;

	/**
	 * Lock to landscape orientation for gameplay.
	 */
	useEffect(() => {
		ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

		return () => {
			// Unlock when leaving screen
			ScreenOrientation.unlockAsync();
		};
	}, []);

	/**
	 * Connect to the streaming session.
	 */
	useEffect(() => {
		const socket = io(serverUrl, {
			transports: ["websocket"],
			query: {
				role: "viewer",
				sessionId: params.sessionId,
			},
		});

		socketRef.current = socket;

		socket.on("connect", async () => {
			console.log("[Play] Connected to server");

			// Initialize WebRTC service
			const webrtc = createWebRTCService(socket, params.sessionId, {
				onTrack: (stream: MediaStream) => {
					console.log("[Play] Received video stream");
					const url = stream.toURL();
					setStreamURL(url);
					setConnectionState("playing");
				},
				onConnectionState: (state) => {
					console.log("[Play] WebRTC connection state:", state);
					if (state === "connected") {
						setConnectionState("streaming");
					} else if (state === "failed" || state === "disconnected") {
						setConnectionState("error");
						setErrorMessage("Video connection lost");
					}
				},
				onError: (error) => {
					console.error("[Play] WebRTC error:", error);
					setErrorMessage(error.message);
					setConnectionState("error");
				},
			});

			webrtcRef.current = webrtc;

			try {
				await webrtc.initialize();
				console.log("[Play] WebRTC initialized");

				// Join the streaming session
				socket.emit("join_stream", { sessionId: params.sessionId });
			} catch (error) {
				console.error("[Play] Failed to initialize WebRTC:", error);
				setErrorMessage("Failed to start video");
				setConnectionState("error");
			}
		});

		socket.on("stream_joined", ({ sessionId, game }) => {
			console.log("[Play] Joined stream:", sessionId);
			setConnectionState("waiting");
		});

		socket.on("error", (message: string) => {
			console.error("[Play] Error:", message);
			setErrorMessage(message);
			setConnectionState("error");
		});

		socket.on("disconnect", () => {
			console.log("[Play] Disconnected");
			setConnectionState("disconnected");
		});

		// Timeout if we don't get a video stream
		const timeout = setTimeout(() => {
			if (connectionState === "connecting" || connectionState === "waiting") {
				console.log("[Play] Timeout waiting for stream, showing placeholder");
				// Don't error out - the user might need to open the stream page on PC
				setConnectionState("playing");
			}
		}, 5000);

		return () => {
			clearTimeout(timeout);
			webrtcRef.current?.destroy();
			socket.disconnect();
		};
	}, [serverUrl, params.sessionId]);

	/**
	 * Handle controller button press.
	 */
	const handleButtonPress = useCallback((button: string) => {
		socketRef.current?.emit("input", {
			button,
			pressed: true,
			timestamp: Date.now(),
		});
	}, []);

	/**
	 * Handle controller button release.
	 */
	const handleButtonRelease = useCallback((button: string) => {
		socketRef.current?.emit("input", {
			button,
			pressed: false,
			timestamp: Date.now(),
		});
	}, []);

	/**
	 * Handle analog stick movement.
	 */
	const handleAnalogMove = useCallback(
		(stick: "STICK_L" | "STICK_R", x: number, y: number) => {
			socketRef.current?.emit("analog", {
				stick,
				x,
				y,
				timestamp: Date.now(),
			});
		},
		[]
	);

	/**
	 * Exit gameplay and return to games list.
	 */
	const exitGame = () => {
		Alert.alert("Exit Game", "Are you sure you want to stop playing?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Exit",
				style: "destructive",
				onPress: () => router.back(),
			},
		]);
	};

	// Render connecting/waiting states
	if (connectionState === "connecting" || connectionState === "waiting") {
		return (
			<View style={styles.statusContainer}>
				<ActivityIndicator size="large" color="#6366f1" />
				<Text style={styles.statusText}>
					{connectionState === "connecting"
						? "Connecting to server..."
						: "Waiting for stream..."}
				</Text>
				<Text style={styles.gameTitle}>{params.gameTitle}</Text>
				<TouchableOpacity
					style={styles.cancelButton}
					onPress={() => router.back()}
				>
					<Text style={styles.cancelButtonText}>Cancel</Text>
				</TouchableOpacity>
			</View>
		);
	}

	// Render error state
	if (connectionState === "error" || connectionState === "disconnected") {
		return (
			<View style={styles.statusContainer}>
				<Text style={styles.errorEmoji}>❌</Text>
				<Text style={styles.errorText}>
					{connectionState === "error" ? errorMessage : "Connection lost"}
				</Text>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
				>
					<Text style={styles.backButtonText}>Back to Games</Text>
				</TouchableOpacity>
			</View>
		);
	}

	// Render gameplay screen
	return (
		<View style={styles.container}>
			{/* Video display */}
			<View style={styles.videoContainer}>
				{streamURL ? (
					<RTCView
						streamURL={streamURL}
						style={styles.video}
						objectFit="contain"
						mirror={false}
						zOrder={0}
					/>
				) : (
					<View style={styles.videoPlaceholder}>
						<Text style={styles.videoPlaceholderEmoji}>🎮</Text>
						<Text style={styles.videoPlaceholderText}>{params.gameTitle}</Text>
						<Text style={styles.videoPlaceholderHint}>
							Waiting for video stream...
						</Text>
						<Text style={styles.videoPlaceholderHint}>
							Open http://{params.host}:{params.port}/stream on your PC
						</Text>
					</View>
				)}
			</View>

			{/* Virtual controller overlay */}
			<VirtualController
				onButtonPress={handleButtonPress}
				onButtonRelease={handleButtonRelease}
				onAnalogMove={handleAnalogMove}
				system={params.gameSystem}
			/>

			{/* Exit button */}
			<TouchableOpacity style={styles.exitButton} onPress={exitGame}>
				<Text style={styles.exitButtonText}>✕</Text>
			</TouchableOpacity>

			{/* Connection indicator */}
			<View style={styles.connectionIndicator}>
				<View
					style={[
						styles.connectionDot,
						{ backgroundColor: streamURL ? "#22c55e" : "#eab308" },
					]}
				/>
				<Text style={styles.connectionText}>
					{streamURL ? "Connected" : "No video"}
				</Text>
			</View>
		</View>
	);
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
	},
	statusContainer: {
		flex: 1,
		backgroundColor: "#0f0f1a",
		justifyContent: "center",
		alignItems: "center",
		padding: 32,
	},
	statusText: {
		color: "#888",
		fontSize: 18,
		marginTop: 16,
	},
	gameTitle: {
		color: "#fff",
		fontSize: 24,
		fontWeight: "bold",
		marginTop: 8,
	},
	cancelButton: {
		marginTop: 32,
		paddingHorizontal: 24,
		paddingVertical: 12,
		backgroundColor: "#333",
		borderRadius: 8,
	},
	cancelButtonText: {
		color: "#fff",
		fontSize: 16,
	},
	errorEmoji: {
		fontSize: 64,
		marginBottom: 16,
	},
	errorText: {
		color: "#ff4444",
		fontSize: 18,
		textAlign: "center",
	},
	backButton: {
		marginTop: 32,
		paddingHorizontal: 24,
		paddingVertical: 12,
		backgroundColor: "#6366f1",
		borderRadius: 8,
	},
	backButtonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "600",
	},
	videoContainer: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "#000",
		justifyContent: "center",
		alignItems: "center",
	},
	video: {
		width: "100%",
		height: "100%",
	},
	videoPlaceholder: {
		alignItems: "center",
	},
	videoPlaceholderEmoji: {
		fontSize: 64,
		marginBottom: 16,
	},
	videoPlaceholderText: {
		color: "#fff",
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 8,
	},
	videoPlaceholderHint: {
		color: "#666",
		fontSize: 14,
		marginTop: 4,
	},
	exitButton: {
		position: "absolute",
		top: 16,
		right: 16,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(255, 255, 255, 0.2)",
		justifyContent: "center",
		alignItems: "center",
		zIndex: 10,
	},
	exitButtonText: {
		color: "#fff",
		fontSize: 20,
	},
	connectionIndicator: {
		position: "absolute",
		top: 16,
		left: 16,
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		zIndex: 10,
	},
	connectionDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		marginRight: 8,
	},
	connectionText: {
		color: "#fff",
		fontSize: 12,
	},
});
