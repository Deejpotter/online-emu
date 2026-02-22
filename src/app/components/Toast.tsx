/**
 * Toast Component
 *
 * Simple toast notification system for displaying feedback messages.
 * Supports success, error, and info states with auto-dismiss.
 */

"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
	id: string;
	message: string;
	type: ToastType;
}

interface ToastContextValue {
	showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook to access toast functions.
 * Must be used within a ToastProvider.
 */
export function useToast() {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
}

/**
 * Toast icons by type.
 */
const TOAST_ICONS: Record<ToastType, string> = {
	success: "✅",
	error: "❌",
	info: "ℹ️",
};

/**
 * Toast colors by type.
 */
const TOAST_COLORS: Record<ToastType, string> = {
	success: "bg-green-600/90 border-green-500/50",
	error: "bg-red-600/90 border-red-500/50",
	info: "bg-blue-600/90 border-blue-500/50",
};

interface ToastProviderProps {
	children: React.ReactNode;
}

/**
 * ToastProvider wraps the app and provides toast notification functionality.
 */
export function ToastProvider({ children }: ToastProviderProps) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const showToast = useCallback((message: string, type: ToastType = "info") => {
		const id = Math.random().toString(36).substr(2, 9);
		setToasts((prev) => [...prev, { id, message, type }]);

		// Auto-dismiss after 3 seconds
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 3000);
	}, []);

	const dismissToast = (id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	};

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}

			{/* Toast Container - fixed at bottom right */}
			<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className={`
							pointer-events-auto
							flex items-center gap-3 px-4 py-3 rounded-lg border
							shadow-lg backdrop-blur-sm
							animate-slide-in
							${TOAST_COLORS[toast.type]}
						`}
						onClick={() => dismissToast(toast.id)}
						role="alert"
					>
						<span className="text-lg">{TOAST_ICONS[toast.type]}</span>
						<span className="text-sm font-medium text-white">{toast.message}</span>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}
