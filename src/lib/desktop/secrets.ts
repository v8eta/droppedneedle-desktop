import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Bearer-token storage. In Tauri, tokens live in the OS credential store
 * (Windows Credential Manager) via the Rust keyring commands. In browser dev
 * they fall back to localStorage — acceptable for the dev sandbox only.
 */
const DEV_PREFIX = 'dn-desktop-dev-secret:';

export async function secretSet(account: string, value: string): Promise<void> {
	if (isTauri()) {
		await invoke('secret_set', { account, value });
	} else {
		localStorage.setItem(DEV_PREFIX + account, value);
	}
}

export async function secretGet(account: string): Promise<string | null> {
	if (isTauri()) {
		return await invoke<string | null>('secret_get', { account });
	}
	return localStorage.getItem(DEV_PREFIX + account);
}

export async function secretDelete(account: string): Promise<void> {
	if (isTauri()) {
		await invoke('secret_delete', { account });
	} else {
		localStorage.removeItem(DEV_PREFIX + account);
	}
}
