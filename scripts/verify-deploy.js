#!/usr/bin/env node

/**
 * Post-deploy check for a running online-emu instance (staging or production).
 *
 *   node scripts/verify-deploy.js https://roms-staging.deejpotter.com
 *   node scripts/verify-deploy.js https://roms.deejpotter.com --ref origin/main
 *
 * Checks, all without a profile cookie (like the player page's own requests):
 * - /api/status answers with success: true
 * - every static file the player page loads is served directly with the
 *   right content type, not redirected to /profiles
 * - the live emulator.html matches the expected version (the local file, or
 *   the given git ref), so a failed deploy can't pass for a successful one
 *
 * Exits non-zero when any check fails.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

/** Files the player page loads, with the content type each must have. */
const PLAYER_ASSETS = [
	{ path: "/emulator.html", type: "text/html" },
	{ path: "/save-guard.js", type: "javascript" },
	{ path: "/emulatorjs/data/loader.js", type: "javascript" },
	{ path: "/sw.js", type: "javascript" },
];

/**
 * Run all checks against baseUrl.
 * @param {string} baseUrl
 * @param {{ fetch: typeof fetch, expectedEmulatorHtml?: string }} deps
 * @returns {Promise<{ ok: boolean, results: { name: string, ok: boolean, detail: string }[] }>}
 */
async function verifyDeploy(baseUrl, { fetch, expectedEmulatorHtml }) {
	const base = baseUrl.replace(/\/+$/, "");
	const results = [];
	const record = (name, ok, detail) => results.push({ name, ok, detail });

	try {
		const res = await fetch(`${base}/api/status`, { redirect: "manual" });
		const body = res.status === 200 ? await res.json().catch(() => null) : null;
		record("api/status", Boolean(body && body.success), `HTTP ${res.status}`);
	} catch (err) {
		record("api/status", false, String(err));
	}

	for (const asset of PLAYER_ASSETS) {
		try {
			const res = await fetch(`${base}${asset.path}`, { redirect: "manual" });
			const type = res.headers.get("content-type") || "";
			const ok = res.status === 200 && type.includes(asset.type);
			const detail =
				res.status >= 300 && res.status < 400
					? `redirected to ${res.headers.get("location")}`
					: `HTTP ${res.status} ${type}`;
			record(asset.path, ok, detail);

			if (asset.path === "/emulator.html" && expectedEmulatorHtml !== undefined && res.status === 200) {
				const live = await res.text();
				record(
					"emulator.html is the expected version",
					live === expectedEmulatorHtml,
					live === expectedEmulatorHtml ? "matches" : "differs (deploy not live yet, or failed)"
				);
			}
		} catch (err) {
			record(asset.path, false, String(err));
		}
	}

	return { ok: results.every((r) => r.ok), results };
}

function expectedHtml(ref) {
	if (!ref) return fs.readFileSync(path.join(__dirname, "..", "public", "emulator.html"), "utf8");
	return execFileSync("git", ["show", `${ref}:public/emulator.html`], { encoding: "utf8" });
}

async function main() {
	const args = process.argv.slice(2);
	const baseUrl = args.find((a) => !a.startsWith("--"));
	const refIndex = args.indexOf("--ref");
	const ref = refIndex >= 0 ? args[refIndex + 1] : undefined;
	if (!baseUrl) {
		console.error("Usage: node scripts/verify-deploy.js <base-url> [--ref <git-ref>]");
		process.exit(2);
	}

	const { ok, results } = await verifyDeploy(baseUrl, {
		fetch: globalThis.fetch,
		expectedEmulatorHtml: expectedHtml(ref),
	});
	for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`);
	console.log(ok ? "\nDeploy verified." : "\nDeploy check FAILED.");
	process.exit(ok ? 0 : 1);
}

if (require.main === module) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}

module.exports = { verifyDeploy, PLAYER_ASSETS };
