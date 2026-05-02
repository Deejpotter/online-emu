import type { NextConfig } from "next";
import path from "path";

/**
 * Next.js Configuration
 *
 * Key settings:
 * - turbopack.root: Ensures module resolution works in monorepo structure
 * - headers: Adds COEP/COOP headers required for EmulatorJS SharedArrayBuffer
 *
 * EmulatorJS requires Cross-Origin headers for WebAssembly threading:
 * - Cross-Origin-Embedder-Policy: require-corp (allows SharedArrayBuffer)
 * - Cross-Origin-Opener-Policy: same-origin (isolates browsing context)
 *
 * Without these headers, WASM cores fail to compile with "SharedArrayBuffer is not defined"
 * See: https://emulatorjs.org/docs/faq/
 */
const nextConfig: NextConfig = {
	turbopack: {
		root: path.resolve(__dirname),
	},

	/**
	 * HTTP Headers for Cross-Origin Isolation
	 * Required for EmulatorJS WASM cores to use SharedArrayBuffer
	 */
	async headers() {
		return [
			{
				// Apply to all routes
				source: "/:path*",
				headers: [
					{
						key: "Cross-Origin-Embedder-Policy",
						value: "require-corp",
					},
					{
						key: "Cross-Origin-Opener-Policy",
						value: "same-origin",
					},
				],
			},
			{
				// Prevent browsers caching the localization file or emulator page.
				// These are small static files that change during development;
				// a stale cached empty en-US.json causes hundreds of translation warnings.
				source: "/:path(emulator\\.html|emulatorjs/data/localization/.+)",
				headers: [
					{
						key: "Cache-Control",
						value: "no-store",
					},
				],
			},
		];
	},
};

export default nextConfig;
