import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { GameLibrary } from "@/app/components/GameLibrary";
import type { Game } from "@/types";

jest.mock("@/app/components/Toast", () => ({
	useToast: () => ({ showToast: jest.fn() }),
}));

function makeGame(id: string, title: string, lastPlayed?: string): Game {
	return { id, title, system: "nes", romPath: `nes/${id}.nes`, lastPlayed } as Game;
}

function mockGames(games: Game[]) {
	global.fetch = jest.fn(() =>
		Promise.resolve({
			json: () => Promise.resolve({ success: true, data: { games } }),
		} as Response)
	) as jest.Mock;
}

describe("GameLibrary continue playing row", () => {
	beforeEach(() => {
		localStorage.clear();
		window.history.replaceState(null, "", "/");
	});

	test("lists played games newest first and lets you launch one", async () => {
		mockGames([
			makeGame("a", "Alpha Quest", "2026-10-01T00:00:00Z"),
			makeGame("b", "Beta Run"),
			makeGame("c", "Gamma Strike", "2026-10-30T00:00:00Z"),
		]);
		const onSelect = jest.fn();
		render(<GameLibrary onSelectGame={onSelect} />);

		const section = (await screen.findByRole("heading", { name: "Continue playing" }))
			.parentElement as HTMLElement;
		const titles = within(section).getAllByText(/Quest|Run|Strike/).map((el) => el.textContent);
		expect(titles).toEqual(["Gamma Strike", "Alpha Quest"]);

		fireEvent.click(within(section).getByText("Gamma Strike"));
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }));
	});

	test("hidden when nothing has been played", async () => {
		mockGames([makeGame("b", "Beta Run")]);
		render(<GameLibrary onSelectGame={() => {}} />);
		await screen.findAllByText("Beta Run");
		expect(screen.queryByRole("heading", { name: "Continue playing" })).toBeNull();
	});

	test("hidden while searching", async () => {
		mockGames([makeGame("a", "Alpha Quest", "2026-10-01T00:00:00Z")]);
		render(<GameLibrary onSelectGame={() => {}} />);
		await screen.findByRole("heading", { name: "Continue playing" });
		fireEvent.change(screen.getByLabelText("Search games"), { target: { value: "alpha" } });
		expect(screen.queryByRole("heading", { name: "Continue playing" })).toBeNull();
	});
});
