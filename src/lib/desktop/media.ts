import { isTauri } from '@tauri-apps/api/core';

/**
 * Resolves an API media path (cover art, held-track audio) to a URL that a
 * plain <img>/<audio> element can load with authentication.
 *
 * In Tauri this routes through the dn:// custom scheme (surfaced on Windows
 * as http://dn.localhost/...), whose Rust handler proxies to the active
 * server with the bearer header and Range support.
 *
 * In browser dev the path stays relative and rides the Vite proxy.
 */
export function mediaUrl(path: string): string {
	if (!path.startsWith('/')) return path;
	if (isTauri()) return `http://dn.localhost${path}`;
	return path;
}
