/**
 * Profile Selection Page
 *
 * Netflix/Plex-style profile picker displayed on first visit.
 * Users select or create a profile to identify their save files.
 *
 * Features:
 * - Display existing profiles as clickable tiles
 * - Create new profile with name and emoji avatar
 * - Delete profiles (with confirmation)
 * - Redirect to home page after selection
 *
 * Profile data is stored server-side in /data/profiles.json.
 * Selected profile ID is stored in a cookie for middleware checks.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Available avatar emojis for profile creation
const AVATAR_OPTIONS = [
	"👤",
	"🎮",
	"👾",
	"🕹️",
	"🎯",
	"⭐",
	"🔥",
	"💎",
	"🌟",
	"🚀",
	"🦊",
	"🐉",
	"🐺",
	"🦁",
	"🐸",
	"🐱",
];

interface Profile {
	id: string;
	name: string;
	avatar?: string;
	createdAt: string;
}

export default function ProfilesPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectUrl = searchParams.get("redirect") || "/";

	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Create profile modal state
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");
	const [newAvatar, setNewAvatar] = useState("👤");
	const [creating, setCreating] = useState(false);

	// Delete confirmation state
	const [deleteId, setDeleteId] = useState<string | null>(null);

	// Fetch profiles on mount
	useEffect(() => {
		fetchProfiles();
	}, []);

	async function fetchProfiles() {
		try {
			const res = await fetch("/api/profiles");
			if (!res.ok) throw new Error("Failed to fetch profiles");
			const data = await res.json();
			setProfiles(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	}

	async function selectProfile(profile: Profile) {
		// Set profile ID in cookie (1 year expiry)
		document.cookie = `profileId=${profile.id}; path=/; max-age=${
			365 * 24 * 60 * 60
		}`;
		// Redirect to original destination or home
		router.push(redirectUrl);
	}

	async function createProfile() {
		if (!newName.trim()) return;

		setCreating(true);
		setError(null);

		try {
			const res = await fetch("/api/profiles", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newName.trim(), avatar: newAvatar }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to create profile");
			}

			const profile = await res.json();
			setProfiles([...profiles, profile]);
			setShowCreate(false);
			setNewName("");
			setNewAvatar("👤");

			// Auto-select the new profile
			selectProfile(profile);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setCreating(false);
		}
	}

	async function confirmDelete() {
		if (!deleteId) return;

		try {
			const res = await fetch(`/api/profiles/${deleteId}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Failed to delete profile");

			setProfiles(profiles.filter((p) => p.id !== deleteId));
			setDeleteId(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-zinc-900 to-zinc-950 flex items-center justify-center">
				<div className="text-zinc-400">Loading profiles...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-zinc-900 to-zinc-950 flex flex-col items-center justify-center p-4">
			{/* Header */}
			<div className="text-center mb-12">
				<span className="text-6xl mb-4 block">🎮</span>
				<h1 className="text-3xl font-bold mb-2">Who&apos;s Playing?</h1>
				<p className="text-zinc-400">Select your profile to load your saves</p>
			</div>

			{/* Error Message */}
			{error && (
				<div className="mb-6 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
					{error}
				</div>
			)}

			{/* Profile Grid */}
			<div className="flex flex-wrap justify-center gap-6 max-w-4xl">
				{profiles.map((profile) => (
					<div key={profile.id} className="relative group">
						<button
							onClick={() => selectProfile(profile)}
							className="flex flex-col items-center p-6 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 hover:border-zinc-600 transition-all duration-200 w-32"
						>
							<span className="text-5xl mb-3">{profile.avatar || "👤"}</span>
							<span className="text-sm font-medium truncate w-full text-center">
								{profile.name}
							</span>
						</button>
						{/* Delete button (shown on hover) */}
						<button
							onClick={() => setDeleteId(profile.id)}
							className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
							title="Delete profile"
						>
							✕
						</button>
					</div>
				))}

				{/* Add New Profile Button */}
				<button
					onClick={() => setShowCreate(true)}
					className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 transition-all duration-200 w-32 h-[140px]"
				>
					<span className="text-4xl mb-2">➕</span>
					<span className="text-sm">Add Profile</span>
				</button>
			</div>

			{/* Create Profile Modal */}
			{showCreate && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
					<div className="bg-zinc-800 rounded-xl p-6 w-full max-w-md border border-zinc-700">
						<h2 className="text-xl font-bold mb-4">Create Profile</h2>

						{/* Avatar Selection */}
						<div className="mb-4">
							<label className="block text-sm text-zinc-400 mb-2">
								Choose Avatar
							</label>
							<div className="flex flex-wrap gap-2">
								{AVATAR_OPTIONS.map((avatar) => (
									<button
										key={avatar}
										onClick={() => setNewAvatar(avatar)}
										className={`text-2xl p-2 rounded-lg transition-all ${
											newAvatar === avatar
												? "bg-blue-500/30 ring-2 ring-blue-500"
												: "bg-zinc-700/50 hover:bg-zinc-700"
										}`}
									>
										{avatar}
									</button>
								))}
							</div>
						</div>

						{/* Name Input */}
						<div className="mb-6">
							<label className="block text-sm text-zinc-400 mb-2">
								Profile Name
							</label>
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="Enter name..."
								maxLength={20}
								className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter" && newName.trim()) {
										createProfile();
									}
								}}
							/>
						</div>

						{/* Buttons */}
						<div className="flex gap-3">
							<button
								onClick={() => {
									setShowCreate(false);
									setNewName("");
									setNewAvatar("👤");
									setError(null);
								}}
								className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={createProfile}
								disabled={!newName.trim() || creating}
								className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg transition-colors"
							>
								{creating ? "Creating..." : "Create"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{deleteId && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
					<div className="bg-zinc-800 rounded-xl p-6 w-full max-w-sm border border-zinc-700">
						<h2 className="text-xl font-bold mb-2">Delete Profile?</h2>
						<p className="text-zinc-400 text-sm mb-6">
							This will remove the profile. Save files will be kept.
						</p>

						<div className="flex gap-3">
							<button
								onClick={() => setDeleteId(null)}
								className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={confirmDelete}
								className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
