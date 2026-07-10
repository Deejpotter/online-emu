import React from "react";
import { render, screen } from "@testing-library/react";
import { EmulatorContent } from "@/app/play/EmulatorContent";

jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams("?id=g1"),
}));
jest.mock("@/app/components", () => ({
	useToast: () => ({ showToast: jest.fn() }),
}));

describe("EmulatorContent - fetch & threading behavior", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test("renders iframe when API returns game data", async () => {
		const fakeGame = {
			id: "g1",
			title: "Test Game 1",
			system: "nes",
			romPath: "nes/ROMs/test.nes",
		};

		jest
			.spyOn(global, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ success: true, data: { game: fakeGame } })
				)
			);

		render(<EmulatorContent />);

		const iframe = await screen.findByTitle(/Test Game 1 - EmulatorJS/i);
		expect(iframe).toBeInTheDocument();
		const src = (iframe as HTMLIFrameElement).getAttribute("src") || "";
		expect(src).toContain("/emulator.html?");
		expect(src).toContain("system=nes");
	});

	test("renders iframe for a GBA game without threading warning", async () => {
		const fakeGame = {
			id: "gba1",
			title: "GBA Game",
			system: "gba",
			romPath: "gba/ROMs/game.gba",
		};

		jest
			.spyOn(global, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ success: true, data: { game: fakeGame } })
				)
			);

		render(<EmulatorContent />);

		const iframe = await screen.findByTitle(/GBA Game - EmulatorJS/i);
		expect(iframe).toBeInTheDocument();
		const src = (iframe as HTMLIFrameElement).getAttribute("src") || "";
		expect(src).toContain("system=gba");
		expect(src).toContain("core=gba");
	});

	test("shows error UI when API returns failure", async () => {
		jest
			.spyOn(global, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ success: false, error: "Not found" }))
			);

		render(<EmulatorContent />);

		expect(await screen.findByText(/Failed to load game/i)).toBeInTheDocument();
	});
});
