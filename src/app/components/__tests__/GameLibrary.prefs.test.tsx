import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GameLibrary } from "@/app/components/GameLibrary";

const mockShowToast = jest.fn();
jest.mock("@/app/components/Toast", () => ({
	useToast: () => ({ showToast: mockShowToast }),
}));

const PREFS_KEY = "online-emu:library-prefs";

function mockFetch(scanResult: unknown) {
	global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
		const body = init?.method === "POST" ? scanResult : { success: true, data: { games: [] } };
		return Promise.resolve({ json: () => Promise.resolve(body) } as Response);
	}) as jest.Mock;
}

describe("GameLibrary preferences and scan feedback", () => {
	beforeEach(() => {
		localStorage.clear();
		mockShowToast.mockClear();
	});

	test("persists view mode to localStorage", async () => {
		mockFetch({ success: true, data: { added: 0 } });
		render(<GameLibrary onSelectGame={() => {}} />);
		fireEvent.click(await screen.findByTitle("List view"));
		await waitFor(() =>
			expect(JSON.parse(localStorage.getItem(PREFS_KEY) || "{}").viewMode).toBe("list")
		);
	});

	test("ignores invalid stored prefs", async () => {
		localStorage.setItem(PREFS_KEY, JSON.stringify({ viewMode: "bogus", sortMode: "alpha" }));
		mockFetch({ success: true, data: { added: 0 } });
		render(<GameLibrary onSelectGame={() => {}} />);
		await waitFor(() =>
			expect(JSON.parse(localStorage.getItem(PREFS_KEY) || "{}").viewMode).toBe("grid")
		);
	});

	test("shows a toast instead of alert after scanning", async () => {
		mockFetch({ success: true, data: { added: 2 } });
		render(<GameLibrary onSelectGame={() => {}} />);
		fireEvent.click(await screen.findByRole("button", { name: /Scan for ROMs/ }));
		await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith("Found 2 new game(s)!", "success"));
	});
});
