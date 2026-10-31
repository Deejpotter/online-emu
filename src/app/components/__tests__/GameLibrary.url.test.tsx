import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GameLibrary } from "@/app/components/GameLibrary";

jest.mock("@/app/components/Toast", () => ({
	useToast: () => ({ showToast: jest.fn() }),
}));

describe("GameLibrary URL sync", () => {
	beforeEach(() => {
		localStorage.clear();
		window.history.replaceState(null, "", "/");
		global.fetch = jest.fn(() =>
			Promise.resolve({
				json: () => Promise.resolve({ success: true, data: { games: [] } }),
			} as Response)
		) as jest.Mock;
	});

	test("reads search and system from the URL", async () => {
		window.history.replaceState(null, "", "/?q=zelda&system=snes");
		render(<GameLibrary onSelectGame={() => {}} />);
		const input = (await screen.findByLabelText("Search games")) as HTMLInputElement;
		await waitFor(() => expect(input.value).toBe("zelda"));
		expect(JSON.parse(localStorage.getItem("online-emu:library-prefs") || "{}").system).toBe("snes");
	});

	test("writes search to the URL and clears it when emptied", async () => {
		render(<GameLibrary onSelectGame={() => {}} />);
		const input = await screen.findByLabelText("Search games");
		fireEvent.change(input, { target: { value: "metroid" } });
		await waitFor(() => expect(window.location.search).toBe("?q=metroid"));
		fireEvent.change(input, { target: { value: "" } });
		await waitFor(() => expect(window.location.search).toBe(""));
	});

	test("ignores unknown systems in the URL", async () => {
		window.history.replaceState(null, "", "/?system=dreamcast");
		render(<GameLibrary onSelectGame={() => {}} />);
		await waitFor(() => expect(window.location.search).toBe(""));
	});
});
