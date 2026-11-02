import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { EmulatorContent } from "@/app/play/EmulatorContent";

jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams("?id=ff-test"),
}));
jest.mock("@/app/components", () => ({
	useToast: () => ({ showToast: jest.fn() }),
}));

function fromEmulator(data: object) {
	act(() => {
		window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin }));
	});
}

async function renderPlaying() {
	jest.spyOn(global, "fetch").mockResolvedValue(
		new Response(
			JSON.stringify({
				success: true,
				data: { game: { id: "ff-test", title: "FF Test", system: "gba", romPath: "gba/t.gba" } },
			})
		) as Response
	);
	render(<EmulatorContent />);
	const iframe = (await screen.findByTitle(/FF Test - EmulatorJS/i)) as HTMLIFrameElement;
	const postSpy = jest.fn();
	(iframe.contentWindow as unknown as { postMessage: jest.Mock }).postMessage = postSpy;
	fromEmulator({ type: "stateChanged", state: "playing" });
	return postSpy;
}

describe("EmulatorContent fast-forward and keys", () => {
	afterEach(() => jest.restoreAllMocks());

	test("the Fast button toggles fast-forward and shows its state", async () => {
		const postSpy = await renderPlaying();
		const button = screen.getByRole("button", { name: /Fast/ });
		expect(button).toHaveAttribute("aria-pressed", "false");
		fireEvent.click(button);
		expect(postSpy).toHaveBeenCalledWith({ type: "toggleFastForward" }, window.location.origin);
		fromEmulator({ type: "fastForwardChanged", on: true });
		expect(button).toHaveAttribute("aria-pressed", "true");
	});

	test("Space toggles fast-forward instead of pressing a button", async () => {
		const postSpy = await renderPlaying();
		fireEvent.keyDown(window, { code: "Space" });
		expect(postSpy).toHaveBeenCalledWith({ type: "toggleFastForward" }, window.location.origin);
		expect(postSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "input" }), expect.anything());
	});

	test("Shift sends Select and X sends A", async () => {
		const postSpy = await renderPlaying();
		fireEvent.keyDown(window, { code: "ShiftLeft" });
		expect(postSpy).toHaveBeenCalledWith({ type: "input", button: "select", pressed: true }, window.location.origin);
		fireEvent.keyDown(window, { code: "KeyX" });
		expect(postSpy).toHaveBeenCalledWith({ type: "input", button: "a", pressed: true }, window.location.origin);
	});

	test("the hint lists the real layout", async () => {
		await renderPlaying();
		expect(screen.getByText(/Shift = Select/)).toBeInTheDocument();
		expect(screen.getByText(/Space = Fast-forward/)).toBeInTheDocument();
	});
});
