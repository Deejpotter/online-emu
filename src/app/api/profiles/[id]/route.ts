/**
 * Single Profile API - Get, Update, Delete
 *
 * GET /api/profiles/[id] - Get profile by ID
 * PATCH /api/profiles/[id] - Update profile name/avatar
 * DELETE /api/profiles/[id] - Delete profile
 *
 * Note: Deleting a profile does NOT delete associated save files.
 * Save files are kept in case the user wants to recover them.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProfileById, updateProfile, deleteProfile } from "@/lib/profiles";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/profiles/[id]
 * Returns a single profile by ID.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;
		const profile = await getProfileById(id);

		if (!profile) {
			return NextResponse.json({ error: "Profile not found" }, { status: 404 });
		}

		return NextResponse.json(profile);
	} catch (error) {
		console.error("[API] Error fetching profile:", error);
		return NextResponse.json(
			{ error: "Failed to fetch profile" },
			{ status: 500 }
		);
	}
}

/**
 * PATCH /api/profiles/[id]
 * Update a profile's name or avatar.
 *
 * Body: { name?: string, avatar?: string }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;
		const body = await request.json();

		const profile = await updateProfile(id, {
			name: body.name,
			avatar: body.avatar,
		});

		if (!profile) {
			return NextResponse.json({ error: "Profile not found" }, { status: 404 });
		}

		return NextResponse.json(profile);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to update profile";
		console.error("[API] Error updating profile:", message);

		if (message.includes("already exists")) {
			return NextResponse.json({ error: message }, { status: 409 });
		}

		return NextResponse.json({ error: message }, { status: 400 });
	}
}

/**
 * DELETE /api/profiles/[id]
 * Delete a profile.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;
		const deleted = await deleteProfile(id);

		if (!deleted) {
			return NextResponse.json({ error: "Profile not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[API] Error deleting profile:", error);
		return NextResponse.json(
			{ error: "Failed to delete profile" },
			{ status: 500 }
		);
	}
}
