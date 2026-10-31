import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameLibrary } from "@/app/components/GameLibrary";

jest.mock("@/app/components/Toast", () => ({
	useToast: () => ({ showToast: jest.fn() }),
}));

describe("GameLibrary search shortcuts", () => {
	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				json: () => Promise.resolve({ success: true, data: { games: [] } }),
			} as Response)
		) as jest.Mock;
	});

	test("'/' focuses the search box and Escape clears it", async () => {
		render(<GameLibrary onSelectGame={() => {}} />);
		const input = (await screen.findByLabelText("Search games")) as HTMLInputElement;

		fireEvent.keyDown(document.body, { key: "/" });
		expect(document.activeElement).toBe(input);

		fireEvent.change(input, { target: { value: "mario" } });
		fireEvent.keyDown(input, { key: "Escape" });
		expect(input.value).toBe("");

		fireEvent.keyDown(input, { key: "Escape" });
		expect(document.activeElement).not.toBe(input);
	});
});
