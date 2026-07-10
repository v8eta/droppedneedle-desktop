import { serviceStatusStore } from '$lib/stores/serviceStatus';
// DESKTOP: route page fetches through the desktop transport
import { desktopFetch } from '$lib/desktop/transport';

let controller = new AbortController();

export function getNavigationSignal(): AbortSignal {
	return controller.signal;
}

export function abortAllPageRequests(): void {
	controller.abort();
	controller = new AbortController();
}

export async function pageFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	if (typeof window === 'undefined') {
		throw new Error('Can never happen, we are running in SPA mode');
	}
	const navSignal = getNavigationSignal();
	const existingSignal = init?.signal;
	const signal = existingSignal ? AbortSignal.any([navSignal, existingSignal]) : navSignal;
	// DESKTOP: fetch → desktopFetch (Rust-backed transport with bearer injection)
	const response = await desktopFetch(input, { ...init, signal });

	const degradedHeader = response.headers.get('X-Degraded-Services');
	if (degradedHeader) {
		serviceStatusStore.recordFromHeader(degradedHeader);
	}

	return response;
}

export { isAbortError } from '$lib/utils/errorHandling';
