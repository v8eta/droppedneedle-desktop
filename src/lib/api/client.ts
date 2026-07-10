import { pageFetch } from '$lib/utils/navigationAbort';
import { browser } from '$app/environment';
import { authStore } from '$lib/stores/authStore.svelte';
// DESKTOP: bearer transport + decoupled session-expiry (no hard redirects in a SPA shell)
import { desktopFetch } from '$lib/desktop/transport';
import { notifySessionExpired } from '$lib/desktop/sessionEvents';

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details: unknown;

	constructor(status: number, message: string, code = '', details: unknown = null) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

/**
 * Thrown when a request fails with 401 while a session was active. The client
 * has already cleared the store and triggered a hard redirect to /login;
 * callers can use `instanceof SessionExpiredError` to suppress error UI that
 * would otherwise flash during navigation.
 */
export class SessionExpiredError extends ApiError {
	constructor(message = 'Session expired') {
		super(401, message, 'session_expired');
		this.name = 'SessionExpiredError';
	}
}

interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {
	signal?: AbortSignal;
	raw?: boolean;
	cache?: RequestCache;
}

async function handleResponse<T = void>(res: Response): Promise<T> {
	if (!res.ok) {
		// DESKTOP: session expired mid-use — hand off to the session module
		// (idempotent expire → SPA route to /login) instead of upstream's
		// window.location.href hard redirect, which would bypass the router
		// under Tauri's static asset protocol.
		if (res.status === 401 && browser && authStore.isAuthenticated) {
			notifySessionExpired();
			throw new SessionExpiredError();
		}

		const text = await res.text().catch(() => '');
		let message = text || `Request failed with status ${res.status}`;
		let code = '';
		let details: unknown = null;
		try {
			const parsed = JSON.parse(text);
			if (parsed?.error?.message) {
				message = parsed.error.message;
				code = parsed.error.code ?? '';
				details = parsed.error.details ?? null;
			} else if (parsed?.detail) {
				message = parsed.detail;
			}
		} catch {
			// text wasn't JSON — use raw text as message
		}
		throw new ApiError(res.status, message, code, details);
	}

	if (res.status === 204 || res.headers.get('content-length') === '0') {
		return undefined as T;
	}

	const text = await res.text().catch(() => '');
	if (text.trim() === '') {
		return undefined as T;
	}

	try {
		return JSON.parse(text) as T;
	} catch {
		throw new ApiError(res.status, 'Failed to parse response JSON');
	}
}

type FetchFn = typeof fetch;

interface ApiClient {
	get<T = unknown>(url: string, opts?: RequestOptions): Promise<T>;
	post<T = unknown>(url: string, body?: unknown, opts?: RequestOptions): Promise<T>;
	put<T = unknown>(url: string, body?: unknown, opts?: RequestOptions): Promise<T>;
	patch<T = unknown>(url: string, body?: unknown, opts?: RequestOptions): Promise<T>;
	delete<T = void>(url: string, opts?: RequestOptions): Promise<T>;
	head(url: string, opts?: RequestOptions): Promise<Response>;
	upload<T = unknown>(url: string, body: FormData, opts?: RequestOptions): Promise<T>;
}

function createClient(fetchFn: FetchFn): ApiClient {
	async function request<T>(
		method: string,
		url: string,
		body?: unknown,
		opts?: RequestOptions
	): Promise<T> {
		const { raw, ...fetchOpts } = opts ?? {};
		// DESKTOP: bearer-only auth — no cookies (upstream sent credentials:'include'
		// for the httpOnly session cookie; the desktop transport injects
		// Authorization: Bearer instead).
		const init: RequestInit = { method, ...fetchOpts };

		if (body !== undefined && body !== null) {
			if (body instanceof FormData) {
				// Do not set Content-Type, the browser sets multipart/form-data with boundary automatically
				init.body = body;
			} else {
				const headers = new Headers(init.headers as HeadersInit | undefined);
				headers.set('Content-Type', 'application/json');
				init.headers = headers;
				init.body = JSON.stringify(body);
			}
		}

		// DESKTOP: pass the path through untouched — desktopFetch resolves it
		// against the active profile (upstream resolved via getApiUrl, which is
		// now the element-media resolver; see api-utils.ts).
		const res = await fetchFn(url, init);

		if (raw) return res as unknown as T;
		return handleResponse<T>(res);
	}

	return {
		get: <T = unknown>(url: string, opts?: RequestOptions) =>
			request<T>('GET', url, undefined, opts),
		post: <T = unknown>(url: string, body?: unknown, opts?: RequestOptions) =>
			request<T>('POST', url, body, opts),
		put: <T = unknown>(url: string, body?: unknown, opts?: RequestOptions) =>
			request<T>('PUT', url, body, opts),
		patch: <T = unknown>(url: string, body?: unknown, opts?: RequestOptions) =>
			request<T>('PATCH', url, body, opts),
		delete: <T = void>(url: string, opts?: RequestOptions) =>
			request<T>('DELETE', url, undefined, opts),
		head: (url: string, opts?: RequestOptions) =>
			request<Response>('HEAD', url, undefined, { ...opts, raw: true }),
		upload: <T = unknown>(url: string, body: FormData, opts?: RequestOptions) =>
			request<T>('POST', url, body, opts)
	};
}

const navClient = createClient(pageFetch);
// DESKTOP: globalThis.fetch → desktopFetch (Rust-backed, CORS-free, bearer-injecting)
const globalClient = createClient((...args) => desktopFetch(...args));

export const api = Object.assign(navClient, { global: globalClient });
