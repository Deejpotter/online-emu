import React from "react";
import { render, screen, act } from "@testing-library/react";
import { EmulatorContent } from "@/app/play/EmulatorContent";

jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams("?id=compact-test"),
}));
jest.mock("@/app/components", () => ({
	useToast: () => ({ showToast: jest.fn() }),
}));

function mockMatchMedia(matches: boolean) {
	window.matchMedia = jest.fn().mockImplementation((query: string) => ({
		matches,
		media: query,
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
	})) as unknown as typeof window.matchMedia;
}

async function renderGame() {
	jest.spyOn(global, "fetch").mockResolvedValue(
		new Response(
			JSON.stringify({
				success: true,
				data: { game: { id: "compact-test", title: "Compact Test", system: "gba", romPath: "gba/t.gba" } },
			})
		) as Response
	);
	render(<EmulatorContent />);
	await screen.findByTitle(/Compact Test - EmulatorJS/i);
}

function startPlaying() {
	act(() => {
		window.dispatchEvent(
			new MessageEvent("message", { data: { type: "stateChanged", state: "playing" }, origin: window.location.origin })
		);
	});
}

describe("EmulatorContent on phones", () => {
	const original = window.matchMedia;
	afterEach(() => {
		window.matchMedia = original;
		jest.restoreAllMocks();
	});

	test("collapses the header when the game starts and keeps the toggle", async () => {
		mockMatchMedia(true);
		await renderGame();
		expect(screen.getByRole("heading", { name: "Compact Test" })).toBeInTheDocument();
		startPlaying();
		expect(screen.queryByRole("heading", { name: "Compact Test" })).toBeNull();
		const toggle = screen.getByRole("button", { name: "Show controls" });
		expect(toggle.className).not.toMatch(/md:hidden/);
		act(() => toggle.click());
		expect(screen.getByRole("heading", { name: "Compact Test" })).toBeInTheDocument();
	});

	test("hides the keyboard hint on touch screens", async () => {
		mockMatchMedia(true);
		await renderGame();
		expect(screen.queryByText(/Keyboard:/)).toBeNull();
	});

	test("desktop keeps the header and the hint while playing", async () => {
		mockMatchMedia(false);
		await renderGame();
		startPlaying();
		expect(screen.getByRole("heading", { name: "Compact Test" })).toBeInTheDocument();
		expect(screen.getByText(/Keyboard:/)).toBeInTheDocument();
	});
});
