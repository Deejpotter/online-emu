/**
 * Profiles API - List and Create
 *
 * GET /api/profiles - List all profiles
 * POST /api/profiles - Create a new profile
 *
 * Profiles are simple user identifiers (no passwords).
 * Used to separate save files between different users of the emulator.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllProfiles, createProfile } from "@/lib/profiles";

/**
 * GET /api/profiles
 * Returns list of all profiles.
 */
export async function GET() {
	try {
		const profiles = await getAllProfiles();
		return NextResponse.json(profiles);
	} catch (error) {
		console.error("[API] Error fetching profiles:", error);
		return NextResponse.json(
			{ error: "Failed to fetch profiles" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/profiles
 * Create a new profile.
 *
 * Body: { name: string, avatar?: string }
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		if (!body.name || typeof body.name !== "string") {
			return NextResponse.json({ error: "Name is required" }, { status: 400 });
		}

		const profile = await createProfile({
			name: body.name,
			avatar: body.avatar,
		});

		return NextResponse.json(profile, { status: 201 });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to create profile";
		console.error("[API] Error creating profile:", message);

		// Return 409 Conflict for duplicate name
		if (message.includes("already exists")) {
			return NextResponse.json({ error: message }, { status: 409 });
		}

		return NextResponse.json({ error: message }, { status: 400 });
	}
}
