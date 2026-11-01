import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { EmulatorContent } from "@/app/play/EmulatorContent";

const mockShowToast = jest.fn();
jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams("?id=slot-test"),
}));
jest.mock("@/app/components", () => ({
	useToast: () => ({ showToast: mockShowToast }),
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
				data: { game: { id: "slot-test", title: "Slot Test", system: "nes", romPath: "nes/t.nes" } },
			})
		) as Response
	);
	render(<EmulatorContent />);
	const iframe = (await screen.findByTitle(/Slot Test - EmulatorJS/i)) as HTMLIFrameElement;
	const postSpy = jest.fn();
	(iframe.contentWindow as unknown as { postMessage: jest.Mock }).postMessage = postSpy;
	fromEmulator({ type: "stateChanged", state: "playing" });
	return postSpy;
}

describe("EmulatorContent save slots", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		localStorage.clear();
	});
	afterEach(() => jest.restoreAllMocks());

	test("Save and Load use the chosen slot and remember it", async () => {
		const postSpy = await renderPlaying();
		fireEvent.change(screen.getByLabelText("Save slot"), { target: { value: "3" } });
		fireEvent.click(screen.getByText("💾 Save"));
		expect(postSpy).toHaveBeenCalledWith({ type: "saveState", slot: 3 }, window.location.origin);
		fireEvent.click(screen.getByText("📂 Load"));
		expect(postSpy).toHaveBeenCalledWith({ type: "loadState", slot: 3 }, window.location.origin);
		expect(localStorage.getItem("online-emu:save-slot")).toBe("3");
	});

	test("restores the remembered slot, ignoring values outside the list", async () => {
		localStorage.setItem("online-emu:save-slot", "2");
		await renderPlaying();
		expect((screen.getByLabelText("Save slot") as HTMLSelectElement).value).toBe("2");
	});

	test("ignores a remembered slot that isn't offered", async () => {
		localStorage.setItem("online-emu:save-slot", "7");
		await renderPlaying();
		expect((screen.getByLabelText("Save slot") as HTMLSelectElement).value).toBe("1");
	});

	test("toasts name the slot, and an empty slot is reported", async () => {
		await renderPlaying();
		fromEmulator({ type: "stateSaved", slot: 2 });
		expect(mockShowToast).toHaveBeenCalledWith("Saved to slot 2", "success");
		fromEmulator({ type: "stateLoaded", slot: 2 });
		expect(mockShowToast).toHaveBeenCalledWith("Loaded slot 2", "success");
		fromEmulator({ type: "stateLoadFailed", slot: 3, reason: "empty" });
		expect(mockShowToast).toHaveBeenCalledWith("Slot 3 is empty", "info");
		fromEmulator({ type: "stateLoadFailed", slot: 3, reason: "error" });
		expect(mockShowToast).toHaveBeenCalledWith("Couldn't load slot 3", "error");
		// The emulator's own slot-0 saves keep the plain wording
		fromEmulator({ type: "stateSaved" });
		expect(mockShowToast).toHaveBeenCalledWith("Game saved!", "success");
	});
});
