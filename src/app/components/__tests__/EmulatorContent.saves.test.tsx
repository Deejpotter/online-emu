import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { EmulatorContent } from "@/app/play/EmulatorContent";

const mockShowToast = jest.fn();
jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams("?id=save-test"),
}));
jest.mock("@/app/components", () => ({
	useToast: () => ({ showToast: mockShowToast }),
}));

function fromEmulator(data: object) {
	act(() => {
		window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin }));
	});
}

async function renderGame() {
	jest.spyOn(global, "fetch").mockResolvedValue(
		new Response(
			JSON.stringify({
				success: true,
				data: { game: { id: "save-test", title: "Save Test", system: "nes", romPath: "nes/t.nes" } },
			})
		) as Response
	);
	render(<EmulatorContent />);
	const iframe = (await screen.findByTitle(/Save Test - EmulatorJS/i)) as HTMLIFrameElement;
	const postSpy = jest.fn();
	(iframe.contentWindow as unknown as { postMessage: jest.Mock }).postMessage = postSpy;
	return postSpy;
}

describe("EmulatorContent save reliability", () => {
	beforeEach(() => jest.clearAllMocks());
	afterEach(() => jest.restoreAllMocks());

	test("warns once after repeated server save failures, and a success resets the count", async () => {
		await renderGame();
		fromEmulator({ type: "serverSaveComplete", success: false });
		expect(mockShowToast).not.toHaveBeenCalled();
		fromEmulator({ type: "serverSaveComplete", success: false });
		expect(mockShowToast).toHaveBeenCalledTimes(1);
		expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/keeps failing/), "error");

		fromEmulator({ type: "serverSaveComplete", success: false });
		expect(mockShowToast).toHaveBeenCalledTimes(1);

		fromEmulator({ type: "serverSaveComplete", success: true });
		fromEmulator({ type: "serverSaveComplete", success: false });
		fromEmulator({ type: "serverSaveComplete", success: false });
		expect(mockShowToast).toHaveBeenCalledTimes(2);
	});

	test("tells the player once when automatic saving is switched off", async () => {
		await renderGame();
		fromEmulator({ type: "autoSaveDisabled", kind: "state" });
		fromEmulator({ type: "autoSaveDisabled", kind: "srm" });
		expect(mockShowToast).toHaveBeenCalledTimes(1);
		expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/automatic saving is off/), "error");
	});

	test("Back asks the emulator to save before leaving while playing", async () => {
		const postSpy = await renderGame();
		fromEmulator({ type: "stateChanged", state: "playing" });

		fireEvent.click(screen.getByText("← Back"));
		expect(postSpy).toHaveBeenCalledWith({ type: "flushSave" }, window.location.origin);
		expect(screen.getByText("Saving...")).toBeInTheDocument();
	});

	test("Back navigates normally before the game is running", async () => {
		const postSpy = await renderGame();
		fireEvent.click(screen.getByText("← Back"));
		expect(postSpy).not.toHaveBeenCalledWith({ type: "flushSave" }, expect.anything());
	});
});
