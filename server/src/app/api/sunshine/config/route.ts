/**
 * Sunshine Configuration API
 *
 * GET /api/sunshine/config - Get current Sunshine configuration
 * POST /api/sunshine/config - Save Sunshine configuration
 * POST /api/sunshine/config/test - Test connection with provided config
 *
 * Note: Passwords are not returned in GET responses for security.
 */

import { NextRequest, NextResponse } from "next/server";
import {
	loadSunshineConfig,
	saveSunshineConfig,
	testConnection,
	type SunshineConfig,
} from "@/lib/sunshine-service";

/**
 * Config response (excludes password for security).
 */
export interface SunshineConfigResponse {
	url: string;
	username: string;
	/** Password is redacted - only shows if configured */
	hasPassword: boolean;
	moonlightWebUrl: string;
	enabled: boolean;
}

/**
 * GET /api/sunshine/config
 * Returns current Sunshine configuration (password redacted).
 */
export async function GET(): Promise<NextResponse<SunshineConfigResponse>> {
	try {
		const config = await loadSunshineConfig();

		return NextResponse.json({
			url: config.url,
			username: config.username,
			hasPassword: Boolean(config.password),
			moonlightWebUrl: config.moonlightWebUrl,
			enabled: config.enabled,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				url: "",
				username: "",
				hasPassword: false,
				moonlightWebUrl: "",
				enabled: false,
				error: message,
			} as SunshineConfigResponse & { error: string },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/sunshine/config
 * Save Sunshine configuration.
 */
export async function POST(
	request: NextRequest
): Promise<NextResponse<{ success: boolean; error?: string }>> {
	try {
		const body = (await request.json()) as Partial<SunshineConfig>;

		// Load existing config to preserve password if not provided
		const existing = await loadSunshineConfig();

		const newConfig: SunshineConfig = {
			url: body.url ?? existing.url,
			username: body.username ?? existing.username,
			// Only update password if explicitly provided (not empty string)
			password:
				body.password !== undefined && body.password !== ""
					? body.password
					: existing.password,
			moonlightWebUrl: body.moonlightWebUrl ?? existing.moonlightWebUrl,
			enabled: body.enabled ?? existing.enabled,
		};

		await saveSunshineConfig(newConfig);

		return NextResponse.json({ success: true });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

/**
 * PUT /api/sunshine/config
 * Test connection with provided config (doesn't save).
 */
export async function PUT(
	request: NextRequest
): Promise<NextResponse<{ success: boolean; error?: string }>> {
	try {
		const body = (await request.json()) as Partial<SunshineConfig>;

		// Load existing config for defaults
		const existing = await loadSunshineConfig();

		const testConfig: SunshineConfig = {
			url: body.url ?? existing.url,
			username: body.username ?? existing.username,
			password: body.password ?? existing.password,
			moonlightWebUrl: body.moonlightWebUrl ?? existing.moonlightWebUrl,
			enabled: true, // Always enabled for test
		};

		const result = await testConnection(testConfig);

		if (result.success) {
			return NextResponse.json({ success: true });
		} else {
			return NextResponse.json(
				{ success: false, error: result.error },
				{ status: 400 }
			);
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}
