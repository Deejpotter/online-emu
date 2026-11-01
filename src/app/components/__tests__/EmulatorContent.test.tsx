import React from "react";
import { render, screen } from "@testing-library/react";
import { EmulatorContent } from "@/app/play/EmulatorContent";

jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams("?id=missing"),
}));
jest.mock("@/app/components", () => ({
	useToast: () => ({ showToast: jest.fn() }),
}));

// Tests that don't need game data get a fetch that never settles, so no state
// update lands after the test ends (tests that do need it override with spyOn)
beforeEach(() => {
	global.fetch = jest.fn(() => new Promise<Response>(() => {})) as jest.Mock;
});

describe("EmulatorContent (smoke)", () => {
	it("renders loading state when no game id", () => {
		render(<EmulatorContent />);
		expect(screen.getByText(/Loading emulator.../i)).toBeInTheDocument();
	});
});
