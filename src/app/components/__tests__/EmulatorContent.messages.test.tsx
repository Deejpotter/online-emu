import React from "react";
import React from "react";
import {
	render,
	screen,
	fireEvent,
	waitFor,
	act,
} from "@testing-library/react";
import { EmulatorContent } from "@/app/play/EmulatorContent";

const mockShowToast = jest.fn();
jest.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams("?id=msg-test"),
}));
jest.mock("@/app/components", () => ({
	useToast: () => ({ showToast: mockShowToast }),
}));

beforeEach(() => {
	jest.clearAllMocks();
});

describe("EmulatorContent - messages, keyboard & UI interactions", () => {
	test("stateSaved/stateLoaded trigger toasts", async () => {
		render(<EmulatorContent />);

		// dispatch stateSaved
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "stateSaved" },
					origin: window.location.host,
				})
			);
		});
		expect(mockShowToast).toHaveBeenCalledWith("Game saved!", "success");

		// dispatch stateLoaded
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "stateLoaded" },
					origin: window.location.host,
				})
			);
		});
		expect(mockShowToast).toHaveBeenCalledWith("Game loaded!", "success");
	});

	test("srmSaveStarted and srmSaveComplete show appropriate toasts", async () => {
		render(<EmulatorContent />);

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "srmSaveStarted" },
					origin: window.location.host,
				})
			);
		});
		expect(mockShowToast).toHaveBeenCalledWith(
			"Saving in-game save...",
			"info"
		);

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "srmSaveComplete", success: true },
					origin: window.location.host,
				})
			);
		});
		expect(mockShowToast).toHaveBeenCalledWith(
			"In-game save uploaded to server",
			"success"
		);

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "srmSaveComplete", success: false },
					origin: window.location.host,
				})
			);
		});
		expect(mockShowToast).toHaveBeenCalledWith(
			"Failed to upload in-game save",
			"error"
		);
	});

	test("keyboard input posts messages to iframe", async () => {
		// mock fetch for game load so component renders iframe
		const fakeGame = {
			id: "msg-test",
			title: "KB Test",
			system: "nes",
			romPath: "nes/ROMs/test.nes",
		};
		jest
			.spyOn(global, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ success: true, data: { game: fakeGame } })
				) as any
			);

		render(<EmulatorContent />);

		const iframe = await screen.findByTitle(/KB Test - EmulatorJS/i);
		// attach a fake contentWindow.postMessage spy
		const postSpy = jest.fn();
		const cw = (iframe as HTMLIFrameElement).contentWindow as any;
		cw.postMessage = postSpy;

		// keydown ArrowUp
		fireEvent.keyDown(window, { code: "ArrowUp" });
		expect(postSpy).toHaveBeenCalledWith(
			{ type: "input", button: "up", pressed: true },
			"*"
		);

		// keyup ArrowUp
		fireEvent.keyUp(window, { code: "ArrowUp" });
		expect(postSpy).toHaveBeenCalledWith(
			{ type: "input", button: "up", pressed: false },
			"*"
		);
	});

	test("ready message marks game as played (PATCH)", async () => {
		// first call: GET /api/games/:id, second call: PATCH to mark played
		const fakeGame = {
			id: "msg-test",
			title: "Ready Test",
			system: "nes",
			romPath: "nes/ROMs/test.nes",
		};
		const fetchMock = jest
			.spyOn(global, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ success: true, data: { game: fakeGame } })
				) as any
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ success: true })) as any
			);

		render(<EmulatorContent />);

		await screen.findByTitle(/Ready Test - EmulatorJS/i);

		// dispatch ready message
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "ready", width: 320, height: 240 },
					origin: window.location.host,
				})
			);
		});

		// expect second fetch to be called with PATCH
		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
			const patchCall = fetchMock.mock.calls[1];
			expect(patchCall[1]).toMatchObject({ method: "PATCH" });
		});
	});

	test("error message sets error UI", async () => {
		const fakeGame = {
			id: "msg-test",
			title: "Error Test",
			system: "nes",
			romPath: "nes/ROMs/test.nes",
		};
		jest
			.spyOn(global, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ success: true, data: { game: fakeGame } })
				) as any
			);

		render(<EmulatorContent />);

		// send error message
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "error", message: "boom" },
					origin: window.location.host,
				})
			);
		});

		// component should render the error message paragraph
		expect(await screen.findByText(/boom/)).toBeInTheDocument();
	});

	test("toggle controls button hides/shows header content and fullscreen button triggers requestFullscreen", async () => {
		const fakeGame = {
			id: "msg-test",
			title: "UI Test",
			system: "nes",
			romPath: "nes/ROMs/test.nes",
		};
		jest
			.spyOn(global, "fetch")
			.mockResolvedValue(
				new Response(
					JSON.stringify({ success: true, data: { game: fakeGame } })
				) as any
			);

		const { container } = render(<EmulatorContent />);

		// wait until game loads and header is rendered
		await screen.findByTitle(/UI Test - EmulatorJS/i);

		// header title should be visible when controls shown
		expect(await screen.findByText("UI Test")).toBeInTheDocument();

		// click toggle header visibility (hide)
		const toggleBtn = screen.getByRole("button", {
			name: /Hide controls|Show controls|▲|▼/i,
		});
		fireEvent.click(toggleBtn);

		// header title should be hidden when controls collapsed
		expect(screen.queryByText("UI Test")).not.toBeInTheDocument();

		// find Full button and stub requestFullscreen on the main container
		const fullBtn = screen.getByRole("button", {
			name: /Toggle fullscreen|⛶ Full/i,
		});
		const mainEl = container.querySelector("main") as HTMLElement;
		(mainEl as any).requestFullscreen = jest.fn().mockResolvedValue(undefined);

		fireEvent.click(fullBtn);
		expect((mainEl as any).requestFullscreen).toHaveBeenCalled();
	});

	test("stateChanged message updates UI states", async () => {
		// prepare fetch and render
		const fakeGame = {
			id: "msg-test",
			title: "State Test",
			system: "nes",
			romPath: "nes/ROMs/test.nes",
		};
		jest
			.spyOn(global, "fetch")
			.mockResolvedValue(
				new Response(
					JSON.stringify({ success: true, data: { game: fakeGame } })
				) as any
			);

		render(<EmulatorContent />);
		await screen.findByTitle(/State Test - EmulatorJS/i);

		// initially loading -> should show Loading
		expect(screen.getByText(/Loading.../i)).toBeInTheDocument();

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "stateChanged", state: "ready" },
					origin: window.location.host,
				})
			);
		});
		// after 'ready', loading indicator removed
		expect(screen.queryByText(/Loading.../i)).not.toBeInTheDocument();

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "stateChanged", state: "paused" },
					origin: window.location.host,
				})
			);
		});
		expect(screen.getByText(/Paused/i)).toBeInTheDocument();
	});

	test("ignores messages from wrong origin or without type", async () => {
		render(<EmulatorContent />);
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { foo: "bar" },
					origin: "http://evil.com",
				})
			);
		});
		// nothing should throw and no toast shown
		expect(mockShowToast).not.toHaveBeenCalled();
	});

	test("save/load buttons post correct messages when visible", async () => {
		const fakeGame = {
			id: "msg-test",
			title: "UI Buttons",
			system: "nes",
			romPath: "nes/ROMs/test.nes",
		};
		jest
			.spyOn(global, "fetch")
			.mockResolvedValue(
				new Response(
					JSON.stringify({ success: true, data: { game: fakeGame } })
				) as any
			);

		const { container } = render(<EmulatorContent />);
		await screen.findByTitle(/UI Buttons - EmulatorJS/i);
		const iframe = screen.getByTitle(
			/UI Buttons - EmulatorJS/i
		) as HTMLIFrameElement;
		const postSpy = jest.fn();
		(iframe.contentWindow as any).postMessage = postSpy;

		// simulate game state playing by dispatching appropriate message
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "stateChanged", state: "playing" },
					origin: window.location.host,
				})
			);
		});

		// save & load buttons should now be visible
		fireEvent.click(screen.getByText("💾 Save"));
		expect(postSpy).toHaveBeenCalledWith({ type: "saveState" }, "*");
		fireEvent.click(screen.getByText("📂 Load"));
		expect(postSpy).toHaveBeenCalledWith({ type: "loadState" }, "*");
	});
});
