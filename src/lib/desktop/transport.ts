import { isTauri } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getConnection } from '$lib/desktop/connection';

/**
 * desktopFetch — the single HTTP chokepoint for the app.
 *
 * In Tauri, requests go through the Rust-backed plugin-http fetch: CORS-free,
 * carries the Authorization header, honors AbortSignal. Production
 * DroppedNeedle sends no CORS headers on /api/v1, so webview fetch() would be
 * blocked; this transport is not optional.
 *
 * In browser dev (Vite on saltbox, no Tauri) it falls back to native fetch
 * with paths left relative so the Vite proxy handles them same-origin.
 *
 * Behaviors:
 * - Relative /api and /health paths resolve against the active profile baseUrl (Tauri).
 * - Bearer token injected unless the path is auth-free or a header is already set.
 * - 30s overall deadline (skipped for SSE / raw-stream requests).
 * - 429 with Retry-After: waits and retries idempotent methods (max 2, cap 15s).
 * - Network-level failures normalize to NetworkError so callers can
 *   distinguish "server unreachable" from HTTP errors.
 * - Per-profile self-signed-cert opt-in via plugin-http danger settings.
 */

export class NetworkError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message);
		this.name = 'NetworkError';
		if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
	}
}

const AUTH_FREE = [
	/^\/health$/,
	/^\/api\/v1\/auth\/login$/,
	/^\/api\/v1\/auth\/setup(\/status)?$/,
	/^\/api\/v1\/auth\/providers$/,
	/^\/api\/v1\/auth\/plex\/(pin|poll)/,
	/^\/api\/v1\/auth\/jellyfin\/login$/,
	/^\/api\/v1\/auth\/oidc\//
];

const OVERALL_TIMEOUT_MS = 30_000;
const MAX_429_RETRIES = 2;
const MAX_RETRY_AFTER_MS = 15_000;

function isAuthFree(path: string): boolean {
	return AUTH_FREE.some((re) => re.test(path));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(resolve, ms);
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(t);
				reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
			},
			{ once: true }
		);
	});
}

function retryAfterMs(res: Response): number {
	const raw = res.headers.get('retry-after');
	const secs = raw ? Number.parseInt(raw, 10) : NaN;
	const ms = Number.isFinite(secs) ? secs * 1000 : 2000;
	return Math.min(ms, MAX_RETRY_AFTER_MS);
}

/**
 * Bare fetch for the connect screen: probes a candidate server BEFORE any
 * profile/connection exists, with an explicit cert-trust override. Never
 * attaches auth; 10s deadline.
 */
export async function probeFetch(
	url: string,
	opts?: { acceptInvalidCerts?: boolean }
): Promise<Response> {
	const init: RequestInit & {
		connectTimeout?: number;
		danger?: { acceptInvalidCerts: boolean; acceptInvalidHostnames: boolean };
	} = { signal: AbortSignal.timeout(10_000) };
	let fetchFn: typeof fetch = globalThis.fetch;
	if (isTauri()) {
		fetchFn = tauriFetch as typeof fetch;
		init.connectTimeout = 10_000;
		if (opts?.acceptInvalidCerts && url.startsWith('https://')) {
			init.danger = { acceptInvalidCerts: true, acceptInvalidHostnames: false };
		}
	}
	try {
		return await fetchFn(url, init);
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') throw err;
		throw new NetworkError(err instanceof Error ? err.message : String(err ?? 'probe failed'), {
			cause: err
		});
	}
}

export async function desktopFetch(
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Response> {
	const tauri = isTauri();
	const conn = getConnection();

	// --- URL resolution ---
	let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
	let path = url;
	if (url.startsWith('/')) {
		if (tauri) {
			if (!conn.baseUrl) throw new NetworkError('No active server connection');
			url = `${conn.baseUrl}${url}`;
		}
	} else {
		try {
			path = new URL(url).pathname;
		} catch {
			path = url;
		}
	}

	// --- headers ---
	const headers = new Headers(init?.headers);
	if (!headers.has('authorization') && conn.token && !isAuthFree(path)) {
		headers.set('Authorization', `Bearer ${conn.token}`);
	}
	const isStream = headers.get('accept')?.includes('text/event-stream') ?? false;

	// --- signal: overall deadline unless streaming ---
	let signal = init?.signal ?? undefined;
	if (!isStream) {
		const deadline = AbortSignal.timeout(OVERALL_TIMEOUT_MS);
		signal = signal ? AbortSignal.any([signal, deadline]) : deadline;
	}

	const method = (init?.method ?? 'GET').toUpperCase();
	const fetchInit: RequestInit & {
		connectTimeout?: number;
		danger?: { acceptInvalidCerts: boolean; acceptInvalidHostnames: boolean };
	} = { ...init, headers, signal };

	let fetchFn: typeof fetch = globalThis.fetch;
	if (tauri) {
		fetchFn = tauriFetch as typeof fetch;
		fetchInit.connectTimeout = 10_000;
		if (conn.acceptInvalidCerts && url.startsWith('https://')) {
			fetchInit.danger = { acceptInvalidCerts: true, acceptInvalidHostnames: false };
		}
	}

	const idempotent = method === 'GET' || method === 'HEAD';
	let attempt = 0;
	for (;;) {
		let res: Response;
		try {
			res = await fetchFn(url, fetchInit);
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') throw err;
			if (err instanceof Error && err.name === 'TimeoutError') {
				throw new NetworkError(`Request timed out: ${method} ${path}`, { cause: err });
			}
			throw new NetworkError(
				err instanceof Error ? err.message : String(err ?? 'request failed'),
				{ cause: err }
			);
		}

		if (res.status === 429 && idempotent && attempt < MAX_429_RETRIES) {
			attempt += 1;
			await sleep(retryAfterMs(res), init?.signal ?? undefined);
			continue;
		}
		return res;
	}
}
