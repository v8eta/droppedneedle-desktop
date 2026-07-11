import { isTauri } from '@tauri-apps/api/core';

/** Launch-at-Windows-sign-in toggle, backed by tauri-plugin-autostart. */
export async function isAutostartEnabled(): Promise<boolean> {
	if (!isTauri()) return false;
	try {
		const { isEnabled } = await import('@tauri-apps/plugin-autostart');
		return await isEnabled();
	} catch {
		return false;
	}
}

export async function setAutostart(enabled: boolean): Promise<void> {
	if (!isTauri()) return;
	const { enable, disable } = await import('@tauri-apps/plugin-autostart');
	if (enabled) await enable();
	else await disable();
}
