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

	test("shows threading warning for PSP when SharedArrayBuffer missing", async () => {
		const fakeGame = {
			id: "psp1",
			title: "PSP Game",
			system: "psp",
			romPath: "psp/ROMs/psp.iso",
		};

		// Ensure SharedArrayBuffer is undefined in this test
		const origSAB = (global as any).SharedArrayBuffer;
		try {
			// delete if present
			try {
				delete (global as any).SharedArrayBuffer;
			} catch {}

			jest
				.spyOn(global, "fetch")
				.mockResolvedValueOnce(
					new Response(
						JSON.stringify({ success: true, data: { game: fakeGame } })
					)
				);

			render(<EmulatorContent />);

			// should show the COEP/COOP warning instead of iframe
			expect(
				await screen.findByText(/Cannot run this game on this origin/i)
			).toBeInTheDocument();
		} finally {
			// restore
			(global as any).SharedArrayBuffer = origSAB;
		}
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
