/**
 * Custom Next.js Server with WebSocket Support
 *
 * This custom server wraps the Next.js application and adds:
 * - Socket.IO for real-time communication
 * - mDNS service advertisement for local network discovery
 * - WebRTC signaling support
 * - Virtual gamepad support for external emulators (PS2/GameCube)
 *
 * Usage:
 *   npm run dev     - Development mode with hot reload
 *   npm run build   - Build for production
 *   npm start       - Production server
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./src/lib/socket-server";
import {
	startMdnsAdvertisement,
	stopMdnsAdvertisement,
	getPrimaryLocalIp,
} from "./src/lib/mdns-service";
import { initializeRomDirectory, scanForNewRoms } from "./src/lib/game-library";
import {
	initializeViGEm,
	cleanupAllControllers,
	isVirtualGamepadAvailable,
} from "./src/lib/virtual-gamepad";
import { stopAllEmulators } from "./src/lib/emulator-launcher";

// Environment configuration
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0"; // Listen on all interfaces
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
	try {
		// Prepare Next.js
		await app.prepare();
		console.log("[Server] Next.js prepared");

		// Initialize ROM directory structure
		await initializeRomDirectory();
		console.log("[Server] ROM directory initialized");

		// Scan for new ROMs
		const { added, total } = await scanForNewRoms();
		console.log(`[Server] Found ${total} games (${added} new)`);

		// Initialize virtual gamepad support (optional - for PS2/GameCube)
		const vigemAvailable = await initializeViGEm();
		if (vigemAvailable) {
			console.log("[Server] Virtual gamepad support enabled (PS2/GameCube)");
		} else {
			console.log(
				"[Server] Virtual gamepad not available (PS2/GameCube support disabled)"
			);
		}

		// Create HTTP server
		const server = createServer((req, res) => {
			try {
				const parsedUrl = parse(req.url || "", true);
				handle(req, res, parsedUrl);
			} catch (err) {
				console.error("[Server] Request handling error:", err);
				res.statusCode = 500;
				res.end("Internal Server Error");
			}
		});

		// Initialize Socket.IO
		initSocketServer(server);
		console.log("[Server] Socket.IO initialized");

		// Start the server
		server.listen(port, hostname, () => {
			const localIp = getPrimaryLocalIp();

			console.log("");
			console.log(
				"═══════════════════════════════════════════════════════════"
			);
			console.log("   🎮 Online Emulator Server");
			console.log(
				"═══════════════════════════════════════════════════════════"
			);
			console.log("");
			console.log(`   Mode:       ${dev ? "Development" : "Production"}`);
			console.log(`   Local:      http://localhost:${port}`);

			if (localIp) {
				console.log(`   Network:    http://${localIp}:${port}`);
			}

			console.log("");
			console.log("   📱 Connect your mobile device to the same network");
			console.log("      and open the OnlineEmu app to start playing!");
			console.log("");
			console.log(
				"═══════════════════════════════════════════════════════════"
			);
			console.log("");

			// Start mDNS advertisement for local network discovery
			startMdnsAdvertisement(port);
		});

		// Graceful shutdown handling
		const shutdown = async () => {
			console.log("\n[Server] Shutting down...");

			stopMdnsAdvertisement();

			// Cleanup external emulator resources
			cleanupAllControllers();
			stopAllEmulators();

			server.close(() => {
				console.log("[Server] HTTP server closed");
				process.exit(0);
			});

			// Force exit after 10 seconds if graceful shutdown fails
			setTimeout(() => {
				console.error("[Server] Forced shutdown after timeout");
				process.exit(1);
			}, 10000);
		};

		process.on("SIGTERM", shutdown);
		process.on("SIGINT", shutdown);
	} catch (err) {
		console.error("[Server] Failed to start:", err);
		process.exit(1);
	}
}

// Start the server
main();
