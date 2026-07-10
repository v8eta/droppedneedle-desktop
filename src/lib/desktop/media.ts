import { getApiUrl } from '$lib/api/api-utils';

/**
 * Resolves an API media path (cover art, held-track audio) to a URL that a
 * plain <img>/<audio> element can load with authentication — the dn:// proxy
 * in Tauri, the Vite proxy in browser dev. Alias of the vendored-facing
 * getApiUrl so desktop code has an honestly-named entry point.
 */
export const mediaUrl = getApiUrl;
