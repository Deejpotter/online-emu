/**
 * SRM (In-Game Saves) API Route
 *
 * Backend: SAVE_STORAGE=r2 (Coolify) or local filesystem (dev).
 */

import { NextRequest, NextResponse } from "next/server";
import {
	getSrm,
	putSrm,
	deleteSrm,
	getSaveStorageBackend,
} from "@/lib/save-storage";

function getProfileId(request: NextRequest): string | null {
	return request.cookies.get("profileId")?.value || null;
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ gameId: string }> }
) {
	try {
		const { gameId } = await params;
		const searchParams = request.nextUrl.searchParams;
		const system = searchParams.get("system");

		const profileId = getProfileId(request);
		if (!profileId) {
			return NextResponse.json(
				{
					success: false,
					error: "No profile selected. Please select a profile first.",
				},
				{ status: 401 }
			);
		}

		if (!system) {
			return NextResponse.json(
				{ success: false, error: "Missing required parameter: system" },
				{ status: 400 }
			);
		}

		const decodedGameId = decodeURIComponent(gameId);
		const result = await getSrm(profileId, system, decodedGameId);

		if (!result) {
			return NextResponse.json(
				{ success: false, error: "SRM file not found" },
				{ status: 404 }
			);
		}

		const { data: srmData, isLegacy } = result;
		console.log(
			`[API] Loaded SRM for "${decodedGameId}" profile=${profileId} (${srmData.length} bytes)${isLegacy ? " [LEGACY]" : ""}`
		);

		return new NextResponse(new Uint8Array(srmData), {
			status: 200,
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Length": srmData.length.toString(),
				"X-Game-Id": decodedGameId,
				"X-Save-Type": "srm",
				"X-Profile-Id": profileId,
				"X-Legacy-Save": isLegacy ? "true" : "false",
				"X-Save-Source": getSaveStorageBackend(),
			},
		});
	} catch (error) {
		if (error instanceof Error && error.message === "Invalid path") {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}
		console.error("[API] Error loading SRM:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to load SRM",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ gameId: string }> }
) {
	try {
		const { gameId } = await params;
		const searchParams = request.nextUrl.searchParams;
		const system = searchParams.get("system");

		const profileId = getProfileId(request);
		if (!profileId) {
			return NextResponse.json(
				{
					success: false,
					error: "No profile selected. Please select a profile first.",
				},
				{ status: 401 }
			);
		}

		if (!system) {
			return NextResponse.json(
				{ success: false, error: "Missing required parameter: system" },
				{ status: 400 }
			);
		}

		const decodedGameId = decodeURIComponent(gameId);
		const arrayBuffer = await request.arrayBuffer();
		const srmData = Buffer.from(arrayBuffer);

		if (srmData.length === 0) {
			return NextResponse.json(
				{ success: false, error: "Empty SRM data" },
				{ status: 400 }
			);
		}

		await putSrm(profileId, system, decodedGameId, srmData);
		console.log(
			`[API] Saved SRM for "${decodedGameId}" profile=${profileId} (${srmData.length} bytes)`
		);

		return NextResponse.json({
			success: true,
			data: {
				gameId: decodedGameId,
				profileId,
				system,
				size: srmData.length,
				source: getSaveStorageBackend(),
			},
		});
	} catch (error) {
		if (error instanceof Error && error.message === "Invalid path") {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}
		console.error("[API] Error saving SRM:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to save SRM",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ gameId: string }> }
) {
	try {
		const { gameId } = await params;
		const searchParams = request.nextUrl.searchParams;
		const system = searchParams.get("system");

		const profileId = getProfileId(request);
		if (!profileId) {
			return NextResponse.json(
				{
					success: false,
					error: "No profile selected. Please select a profile first.",
				},
				{ status: 401 }
			);
		}

		if (!system) {
			return NextResponse.json(
				{ success: false, error: "Missing required parameter: system" },
				{ status: 400 }
			);
		}

		const decodedGameId = decodeURIComponent(gameId);
		const deleted = await deleteSrm(profileId, system, decodedGameId);

		if (!deleted) {
			return NextResponse.json(
				{ success: false, error: "SRM file not found" },
				{ status: 404 }
			);
		}

		console.log(
			`[API] Deleted SRM for "${decodedGameId}" profile=${profileId}`
		);

		return NextResponse.json({
			success: true,
			data: {
				gameId: decodedGameId,
				profileId,
				system,
				deleted: true,
			},
		});
	} catch (error) {
		if (error instanceof Error && error.message === "Invalid path") {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}
		console.error("[API] Error deleting SRM:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to delete SRM",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
