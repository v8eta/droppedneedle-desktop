// DESKTOP: rewritten. Upstream's getApiUrl prepended the PUBLIC_API_URL
// build-time env for BOTH fetches and element-loaded media. In the desktop
// client those needs diverge:
//  - fetch() calls resolve against the active profile inside desktopFetch
//    (the API client passes paths through untouched), and
//  - element loads (<img>/<audio> src) can't carry the bearer header, so they
//    route through the dn:// scheme (surfaced as http://dn.localhost), whose
//    Rust handler proxies to the active server with auth + Range support.
// getApiUrl therefore now serves the MEDIA case — every vendored component
// that builds an image/audio src through it works unmodified.
import { isTauri } from '@tauri-apps/api/core';

/**
 * Resolves an API path to a URL that a plain <img>/<audio> element can load
 * with authentication. In browser dev, paths stay relative and ride the Vite
 * proxy same-origin. Absolute URLs (external cover art) pass through.
 */
export function getApiUrl(path: string): string {
	if (!path.startsWith('/')) {
		return path;
	}
	if (isTauri()) {
		return `http://dn.localhost${path}`;
	}
	return path;
}
