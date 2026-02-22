/**
 * Next.js Middleware for Profile-Based Routing
 *
 * Ensures users have selected a profile before accessing the app.
 * Redirects to /profiles if no profile is selected (checked via cookie).
 *
 * Public routes (no profile required):
 * - /profiles - Profile selection page
 * - /api/profiles - Profile API endpoints
 * - /_next/* - Next.js internal assets
 * - /emulatorjs/* - EmulatorJS static files
 * - Static files (images, manifest, service worker, etc.)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Public paths that don't require a profile
	const publicPaths = [
		"/profiles",
		"/api/profiles",
		"/_next",
		"/emulatorjs",
		"/manifest.json",
		"/sw.js",
		"/icons",
		"/favicon.ico",
	];

	// Check if current path is public
	const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

	if (isPublicPath) {
		return NextResponse.next();
	}

	// Check for profile selection cookie
	const profileId = request.cookies.get("profileId")?.value;

	// Redirect to profile selection if no profile selected
	if (!profileId) {
		const profilesUrl = new URL("/profiles", request.url);
		// Store the original URL to redirect back after profile selection
		profilesUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(profilesUrl);
	}

	return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public files with extensions (e.g., .png, .jpg, .svg)
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
	],
};
