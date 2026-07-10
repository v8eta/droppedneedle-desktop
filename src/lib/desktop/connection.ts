import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Module-level connection state read synchronously by the transport on every
 * request. Session/profile code pushes updates here; in Tauri the same state
 * is mirrored to Rust (for the dn:// media proxy) via `set_connection`.
 *
 * In browser dev (no Tauri) baseUrl stays '' so API paths remain relative and
 * hit the Vite proxy same-origin.
 */
export interface ConnectionInfo {
	baseUrl: string;
	token: string | null;
	acceptInvalidCerts: boolean;
}

let current: ConnectionInfo = { baseUrl: '', token: null, acceptInvalidCerts: false };

export function getConnection(): ConnectionInfo {
	return current;
}

export async function setConnection(info: Partial<ConnectionInfo>): Promise<void> {
	current = { ...current, ...info };
	if (isTauri()) {
		await invoke('set_connection', {
			baseUrl: current.baseUrl || null,
			token: current.token,
			acceptInvalidCerts: current.acceptInvalidCerts
		});
	}
}

export async function clearConnection(): Promise<void> {
	current = { baseUrl: '', token: null, acceptInvalidCerts: false };
	if (isTauri()) {
		await invoke('set_connection', { baseUrl: null, token: null, acceptInvalidCerts: false });
	}
}

/** Normalize user input into a base URL: add scheme if missing, strip trailing slashes. */
export function normalizeBaseUrl(input: string): string {
	let url = input.trim();
	if (url === '') return '';
	if (!/^https?:\/\//i.test(url)) {
		// Bare host → assume https for domains, http for IPs/localhost (typical LAN setup)
		const host = url.split('/')[0].split(':')[0];
		const isIpOrLocal = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost';
		url = `${isIpOrLocal ? 'http' : 'https'}://${url}`;
	}
	url = url.replace(/\/+$/, '');
	// Strip an accidentally pasted /api or /api/v1 suffix
	url = url.replace(/\/api(\/v1)?$/, '');
	return url;
}
