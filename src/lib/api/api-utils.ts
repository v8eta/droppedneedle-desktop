// DESKTOP: upstream resolved paths against the PUBLIC_API_URL build-time env;
// the desktop client resolves against the runtime-selected server profile.
// For element-loaded media (img/audio src) use $lib/desktop/media's mediaUrl()
// instead — plain URLs returned here carry no Authorization header.
import { isTauri } from '@tauri-apps/api/core';
import { getConnection } from '$lib/desktop/connection';

/**
 * Normalizes an API path by prepending the active server's base URL when
 * running inside Tauri. In browser dev, paths stay relative and ride the
 * Vite proxy same-origin.
 */
export function getApiUrl(path: string): string {
	if (!path.startsWith('/')) {
		return path;
	}
	if (isTauri()) {
		const { baseUrl } = getConnection();
		if (baseUrl) return `${baseUrl}${path}`;
	}
	return path;
}
