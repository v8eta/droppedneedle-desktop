import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Frontend side of the system tray. `setTrayStatus` pushes queue counts to the
 * Rust tray (tooltip + taskbar badge); `initTrayNavigation` routes tray-menu
 * jumps (emitted as `tray://navigate`) through the SPA router.
 */
export async function setTrayStatus(status: {
	active?: number;
	held?: number;
}): Promise<void> {
	if (!isTauri()) return;
	try {
		await invoke('set_tray_status', { active: status.active, held: status.held });
	} catch {
		// tray not ready / unavailable — non-critical
	}
}

export async function initTrayNavigation(navigate: (path: string) => void): Promise<void> {
	if (!isTauri()) return;
	try {
		const { listen } = await import('@tauri-apps/api/event');
		await listen<string>('tray://navigate', (event) => navigate(event.payload));
	} catch {
		// event plugin unavailable — tray menu still focuses the window Rust-side
	}
}
