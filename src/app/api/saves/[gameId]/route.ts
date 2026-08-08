/**
 * Game Saves API Route
 *
 * Handles server-side save file storage for EmulatorJS games.
 * Backend: SAVE_STORAGE=r2 (Coolify) or local filesystem (dev).
 */

import { NextRequest, NextResponse } from "next/server";
import {
	getSaveState,
	putSaveState,
	deleteSaveState,
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
		const slot = searchParams.get("slot") || "0";

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
		const result = await getSaveState(profileId, system, decodedGameId, slot);

		if (!result) {
			return NextResponse.json(
				{
					success: false,
					error: "Save file not found",
				},
				{ status: 404 }
			);
		}

		const { data: saveData, isLegacy } = result;
		console.log(
			`[API] Loaded save for "${decodedGameId}" profile=${profileId} (${saveData.length} bytes)${isLegacy ? " [LEGACY]" : ""}`
		);

		return new NextResponse(new Uint8Array(saveData), {
			status: 200,
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Length": saveData.length.toString(),
				"X-Save-Slot": slot,
				"X-Game-Id": decodedGameId,
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
		console.error("[API] Error loading save:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to load save",
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
		const slot = searchParams.get("slot") || "0";

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
		const saveData = await request.arrayBuffer();
		if (!saveData || saveData.byteLength === 0) {
			return NextResponse.json(
				{ success: false, error: "No save data provided" },
				{ status: 400 }
			);
		}

		await putSaveState(
			profileId,
			system,
			decodedGameId,
			slot,
			Buffer.from(saveData)
		);
		console.log(
			`[API] Saved state for "${decodedGameId}" profile=${profileId} (${saveData.byteLength} bytes)`
		);

		return NextResponse.json({
			success: true,
			data: {
				gameId: decodedGameId,
				profileId,
				slot,
				size: saveData.byteLength,
				savedAt: new Date().toISOString(),
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
		console.error("[API] Error saving state:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to save state",
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
		const slot = searchParams.get("slot") || "0";

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
		const deleted = await deleteSaveState(
			profileId,
			system,
			decodedGameId,
			slot
		);

		if (!deleted) {
			return NextResponse.json(
				{ success: false, error: "Save file not found" },
				{ status: 404 }
			);
		}

		console.log(
			`[API] Deleted save for "${decodedGameId}" profile=${profileId} slot=${slot}`
		);

		return NextResponse.json({
			success: true,
			data: { gameId: decodedGameId, profileId, slot, deleted: true },
		});
	} catch (error) {
		if (error instanceof Error && error.message === "Invalid path") {
			return NextResponse.json(
				{ success: false, error: "Invalid path" },
				{ status: 403 }
			);
		}
		console.error("[API] Error deleting save:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to delete save",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
