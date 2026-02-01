/**
 * Sunshine Status API
 *
 * GET /api/sunshine/status - Check Sunshine connection status
 *
 * Returns whether Sunshine is configured, enabled, and reachable.
 */

import { NextResponse } from "next/server";
import {
	loadSunshineConfig,
	checkConnection,
	type SunshineConfig,
} from "@/lib/sunshine-service";

export interface SunshineStatusResponse {
	/** Whether Sunshine integration is enabled in settings */
	enabled: boolean;
	/** Whether credentials are configured */
	configured: boolean;
	/** Whether Sunshine server is reachable */
	connected: boolean;
	/** Error message if connection failed */
	error?: string;
	/** Sunshine server URL */
	url?: string;
	/** moonlight-web-stream URL for streaming */
	moonlightWebUrl?: string;
}

export async function GET(): Promise<NextResponse<SunshineStatusResponse>> {
	try {
		const config: SunshineConfig = await loadSunshineConfig();

		const response: SunshineStatusResponse = {
			enabled: config.enabled,
			configured: Boolean(config.password),
			connected: false,
			url: config.url,
			moonlightWebUrl: config.moonlightWebUrl,
		};

		// Only check connection if enabled and configured
		if (config.enabled && config.password) {
			const result = await checkConnection();
			response.connected = result.success;
			if (!result.success) {
				response.error = result.error;
			}
		}

		return NextResponse.json(response);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				enabled: false,
				configured: false,
				connected: false,
				error: message,
			},
			{ status: 500 }
		);
	}
}
