/**
 * Custom Next.js Server
 *
 * This custom server wraps the Next.js application.
 *
 * Usage:
 *   npm run dev     - Development mode with hot reload
 *   npm run build   - Build for production
 *   npm start       - Production server
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initializeRomDirectory, scanForNewRoms } from "./src/lib/game-library";
import { stopAllEmulators } from "./src/lib/emulator-launcher";
import os from "os";

// Environment configuration
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0"; // Listen on all interfaces
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/**
 * Get primary local IP address
 */
function getPrimaryLocalIp(): string | null {
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces)) {
		const iface = interfaces[name];
		if (!iface) continue;

		for (const alias of iface) {
			if (alias.family === "IPv4" && !alias.internal) {
				return alias.address;
			}
		}
	}
	return null;
}

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
			console.log("   Press Ctrl+C to stop");
			console.log(
				"═══════════════════════════════════════════════════════════"
			);
			console.log("");
		});

		// Graceful shutdown handling
		const shutdown = async () => {
			console.log("\n[Server] Shutting down...");

			// Cleanup external emulator resources
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
