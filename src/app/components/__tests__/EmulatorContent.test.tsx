import React from "react";
import { render, screen } from "@testing-library/react";
import { EmulatorContent } from "@/app/play/EmulatorContent";

jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams("?id=missing"),
}));
jest.mock("@/app/components", () => ({
	useToast: () => ({ showToast: jest.fn() }),
}));

describe("EmulatorContent (smoke)", () => {
	it("renders loading state when no game id", () => {
		render(<EmulatorContent />);
		expect(screen.getByText(/Loading emulator.../i)).toBeInTheDocument();
	});
});
