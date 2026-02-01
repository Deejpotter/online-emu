/**
 * WebRTC Service
 *
 * Manages the WebRTC connection for receiving video streams from the server.
 * This is the "receiver" side - the PC browser captures EmulatorJS canvas
 * and streams it to us via WebRTC.
 *
 * Key responsibilities:
 * - Create RTCPeerConnection as the receiver
 * - Handle ICE candidate exchange via Socket.IO signaling
 * - Manage remote video track and MediaStream
 * - Clean up resources on disconnect
 */

import {
	RTCPeerConnection,
	RTCIceCandidate,
	RTCSessionDescription,
	MediaStream,
} from "react-native-webrtc";
import type { Socket } from "socket.io-client";

// Type definitions for react-native-webrtc events
// The library types are incomplete, so we define our own
type RTCPeerConnectionState =
	| "new"
	| "connecting"
	| "connected"
	| "disconnected"
	| "failed"
	| "closed";
type RTCIceConnectionState =
	| "new"
	| "checking"
	| "connected"
	| "completed"
	| "failed"
	| "disconnected"
	| "closed";

interface RTCPeerConnectionConfig {
	iceServers: Array<{
		urls: string | string[];
		username?: string;
		credential?: string;
	}>;
}

/**
 * WebRTC connection configuration.
 * We use Google's public STUN servers for NAT traversal.
 * Since we're on the same local network, STUN is usually sufficient.
 */
const PEER_CONFIG: RTCPeerConnectionConfig = {
	iceServers: [
		{ urls: "stun:stun.l.google.com:19302" },
		{ urls: "stun:stun1.l.google.com:19302" },
	],
};

/**
 * Events emitted by the WebRTC service.
 */
export interface WebRTCEvents {
	/** Called when a remote video track is received */
	onTrack: (stream: MediaStream) => void;
	/** Called when connection state changes */
	onConnectionState: (state: RTCPeerConnectionState) => void;
	/** Called when ICE connection state changes */
	onIceConnectionState: (state: RTCIceConnectionState) => void;
	/** Called on error */
	onError: (error: Error) => void;
}

/**
 * WebRTC Service class for managing video streaming connections.
 */
export class WebRTCService {
	private peerConnection: RTCPeerConnection | null = null;
	private socket: Socket;
	private sessionId: string;
	private events: Partial<WebRTCEvents>;
	private remoteStream: MediaStream | null = null;
	private remoteCandidates: RTCIceCandidate[] = [];
	private isDestroyed = false;

	constructor(
		socket: Socket,
		sessionId: string,
		events: Partial<WebRTCEvents> = {}
	) {
		this.socket = socket;
		this.sessionId = sessionId;
		this.events = events;

		this.setupSocketListeners();
		console.log("[WebRTC] Service initialized for session:", sessionId);
	}

	/**
	 * Set up Socket.IO listeners for WebRTC signaling.
	 */
	private setupSocketListeners(): void {
		// Handle incoming WebRTC signals from the streamer (PC browser)
		this.socket.on("stream_signal", this.handleSignal.bind(this));

		// Handle stream ended event
		this.socket.on("stream_ended", () => {
			console.log("[WebRTC] Stream ended by server");
			this.destroy();
		});
	}

	/**
	 * Initialize the peer connection.
	 * Creates the RTCPeerConnection and sets up event handlers.
	 */
	public async initialize(): Promise<void> {
		if (this.isDestroyed) {
			console.warn("[WebRTC] Cannot initialize - service is destroyed");
			return;
		}

		try {
			// Create the peer connection
			// Note: We cast to 'any' for addEventListener because react-native-webrtc
			// types are incomplete, but the runtime API matches standard WebRTC
			const pc = new RTCPeerConnection(PEER_CONFIG) as any;
			this.peerConnection = pc;
			console.log("[WebRTC] Peer connection created");

			// Set up event handlers using addEventListener
			// The react-native-webrtc library supports this at runtime
			pc.addEventListener("connectionstatechange", () => {
				const state = pc.connectionState as RTCPeerConnectionState;
				console.log("[WebRTC] Connection state:", state);

				if (state) {
					this.events.onConnectionState?.(state);
				}

				if (state === "failed" || state === "disconnected") {
					this.events.onError?.(new Error(`Connection ${state}`));
				}
			});

			pc.addEventListener("icecandidate", (event: any) => {
				if (event.candidate) {
					console.log("[WebRTC] Sending ICE candidate to server");
					// Send our ICE candidates to the server
					this.socket.emit("stream_signal", {
						sessionId: this.sessionId,
						signal: {
							type: "candidate",
							candidate: event.candidate,
						},
					});
				}
			});

			pc.addEventListener("icecandidateerror", (event: any) => {
				// Most ICE candidate errors can be ignored - connection may still succeed
				console.log("[WebRTC] ICE candidate error (may be non-fatal):", event);
			});

			pc.addEventListener("iceconnectionstatechange", () => {
				const state = pc.iceConnectionState as RTCIceConnectionState;
				console.log("[WebRTC] ICE connection state:", state);

				if (state) {
					this.events.onIceConnectionState?.(state);
				}
			});

			pc.addEventListener("track", (event: any) => {
				console.log("[WebRTC] Received track:", event.track.kind);

				// Create or update remote stream
				if (!this.remoteStream) {
					this.remoteStream = new MediaStream();
				}

				this.remoteStream.addTrack(event.track);

				// Only emit when we have a video track
				if (event.track.kind === "video") {
					console.log("[WebRTC] Video track received, emitting stream");
					this.events.onTrack?.(this.remoteStream);
				}
			});

			pc.addEventListener("negotiationneeded", () => {
				console.log("[WebRTC] Negotiation needed");
				// As the receiver, we wait for the offer from the streamer
			});
		} catch (error) {
			console.error("[WebRTC] Failed to initialize:", error);
			this.events.onError?.(error as Error);
			throw error;
		}
	}

	/**
	 * Handle incoming WebRTC signals from the server.
	 */
	private async handleSignal(data: { signal: any }): Promise<void> {
		if (this.isDestroyed || !this.peerConnection) {
			console.warn("[WebRTC] Received signal but connection not ready");
			return;
		}

		const { signal } = data;
		console.log("[WebRTC] Received signal type:", signal.type);

		try {
			if (signal.type === "offer") {
				// Received an offer from the streamer - set remote description
				const offerDescription = new RTCSessionDescription(signal);
				await this.peerConnection.setRemoteDescription(offerDescription);
				console.log("[WebRTC] Remote description set (offer)");

				// Process any buffered candidates
				await this.processCandidates();

				// Create and send answer
				const answerDescription = await this.peerConnection.createAnswer();
				await this.peerConnection.setLocalDescription(answerDescription);
				console.log("[WebRTC] Local description set (answer)");

				// Send answer back to streamer
				this.socket.emit("stream_signal", {
					sessionId: this.sessionId,
					signal: answerDescription,
				});
			} else if (signal.type === "answer") {
				// We shouldn't receive answers as the receiver, but handle it anyway
				const answerDescription = new RTCSessionDescription(signal);
				await this.peerConnection.setRemoteDescription(answerDescription);
				console.log("[WebRTC] Remote description set (answer)");
			} else if (signal.type === "candidate" && signal.candidate) {
				// Received an ICE candidate from the streamer
				await this.handleRemoteCandidate(signal.candidate);
			}
		} catch (error) {
			console.error("[WebRTC] Error handling signal:", error);
			this.events.onError?.(error as Error);
		}
	}

	/**
	 * Handle incoming ICE candidates, buffering if needed.
	 */
	private async handleRemoteCandidate(
		candidate: RTCIceCandidateInit
	): Promise<void> {
		const iceCandidate = new RTCIceCandidate(candidate);

		if (!this.peerConnection?.remoteDescription) {
			// Buffer candidates until we have the remote description
			console.log("[WebRTC] Buffering ICE candidate");
			this.remoteCandidates.push(iceCandidate);
			return;
		}

		try {
			await this.peerConnection.addIceCandidate(iceCandidate);
			console.log("[WebRTC] Added ICE candidate");
		} catch (error) {
			console.error("[WebRTC] Error adding ICE candidate:", error);
		}
	}

	/**
	 * Process any buffered ICE candidates.
	 */
	private async processCandidates(): Promise<void> {
		if (this.remoteCandidates.length === 0) return;

		console.log(
			"[WebRTC] Processing",
			this.remoteCandidates.length,
			"buffered candidates"
		);

		for (const candidate of this.remoteCandidates) {
			try {
				await this.peerConnection?.addIceCandidate(candidate);
			} catch (error) {
				console.error("[WebRTC] Error adding buffered candidate:", error);
			}
		}

		this.remoteCandidates = [];
	}

	/**
	 * Get the current remote stream.
	 */
	public getRemoteStream(): MediaStream | null {
		return this.remoteStream;
	}

	/**
	 * Check if the connection is established.
	 */
	public isConnected(): boolean {
		return this.peerConnection?.connectionState === "connected";
	}

	/**
	 * Get the stream URL for RTCView component.
	 */
	public getStreamURL(): string | null {
		return this.remoteStream?.toURL() ?? null;
	}

	/**
	 * Clean up and destroy the service.
	 */
	public destroy(): void {
		if (this.isDestroyed) return;

		console.log("[WebRTC] Destroying service");
		this.isDestroyed = true;

		// Remove socket listeners
		this.socket.off("stream_signal");
		this.socket.off("stream_ended");

		// Stop all tracks
		if (this.remoteStream) {
			this.remoteStream.getTracks().forEach((track) => track.stop());
			this.remoteStream = null;
		}

		// Close peer connection
		if (this.peerConnection) {
			this.peerConnection.close();
			this.peerConnection = null;
		}

		this.remoteCandidates = [];
	}
}

/**
 * Create a WebRTC service instance.
 * Factory function for convenience.
 */
export function createWebRTCService(
	socket: Socket,
	sessionId: string,
	events?: Partial<WebRTCEvents>
): WebRTCService {
	return new WebRTCService(socket, sessionId, events);
}
