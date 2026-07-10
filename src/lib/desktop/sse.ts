import { desktopFetch, NetworkError } from '$lib/desktop/transport';
import { notifySessionExpired } from '$lib/desktop/sessionEvents';

/**
 * FetchEventSource — an EventSource-compatible SSE client over desktopFetch.
 *
 * DroppedNeedle authenticates SSE with the bearer header (no query-param
 * token), which the native EventSource can't send — so this reads the
 * text/event-stream body from a streaming fetch instead. The public surface
 * mirrors EventSource (addEventListener/close/readyState + onopen/onerror),
 * letting the vendored upstream SSE consumers switch with a one-line edit:
 * `new EventSource(url)` → `createEventSource(url)`.
 *
 * Extras over native EventSource:
 * - exponential reconnect backoff 1s→30s with ±20% jitter, honoring the
 *   server `retry:` field; backoff resets after 30s of stable connection
 * - Last-Event-ID header replayed on reconnect
 * - 401 mid-stream → notifySessionExpired() and permanent close (a dead
 *   token must not turn into a reconnect storm against the rate limiter)
 */

type Listener = (event: MessageEvent<string>) => void;

export interface FetchEventSource {
	addEventListener(type: string, listener: Listener): void;
	removeEventListener(type: string, listener: Listener): void;
	close(): void;
	readonly readyState: number;
	onopen: (() => void) | null;
	onerror: ((err: unknown) => void) | null;
}

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const STABLE_RESET_MS = 30_000;

export function createEventSource(url: string): FetchEventSource {
	const listeners = new Map<string, Set<Listener>>();
	let readyState = CONNECTING;
	let abort = new AbortController();
	let backoffMs = BACKOFF_MIN_MS;
	let serverRetryMs: number | null = null;
	let lastEventId = '';
	let closed = false;

	const source: FetchEventSource = {
		addEventListener(type, listener) {
			let set = listeners.get(type);
			if (!set) listeners.set(type, (set = new Set()));
			set.add(listener);
		},
		removeEventListener(type, listener) {
			listeners.get(type)?.delete(listener);
		},
		close() {
			closed = true;
			readyState = CLOSED;
			abort.abort();
		},
		get readyState() {
			return readyState;
		},
		onopen: null,
		onerror: null
	};

	function dispatch(type: string, data: string) {
		const event = new MessageEvent<string>(type, { data, lastEventId });
		listeners.get(type)?.forEach((l) => l(event));
	}

	async function consume(body: ReadableStream<Uint8Array>): Promise<void> {
		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let eventType = '';
		let dataLines: string[] = [];

		const flush = () => {
			if (dataLines.length > 0) {
				dispatch(eventType || 'message', dataLines.join('\n'));
			}
			eventType = '';
			dataLines = [];
		};

		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			let nl: number;
			while ((nl = buffer.indexOf('\n')) !== -1) {
				let line = buffer.slice(0, nl);
				buffer = buffer.slice(nl + 1);
				if (line.endsWith('\r')) line = line.slice(0, -1);

				if (line === '') {
					flush();
					continue;
				}
				if (line.startsWith(':')) continue; // comment / keepalive

				const colon = line.indexOf(':');
				const field = colon === -1 ? line : line.slice(0, colon);
				let value2 = colon === -1 ? '' : line.slice(colon + 1);
				if (value2.startsWith(' ')) value2 = value2.slice(1);

				switch (field) {
					case 'event':
						eventType = value2;
						break;
					case 'data':
						dataLines.push(value2);
						break;
					case 'id':
						if (!value2.includes('\0')) lastEventId = value2;
						break;
					case 'retry': {
						const ms = Number.parseInt(value2, 10);
						if (Number.isFinite(ms)) serverRetryMs = ms;
						break;
					}
				}
			}
		}
	}

	async function run(): Promise<void> {
		while (!closed) {
			abort = new AbortController();
			readyState = CONNECTING;
			const connectedAt = Date.now();
			try {
				const headers: Record<string, string> = {
					Accept: 'text/event-stream',
					'Cache-Control': 'no-store'
				};
				if (lastEventId) headers['Last-Event-ID'] = lastEventId;

				const res = await desktopFetch(url, { headers, signal: abort.signal });

				if (res.status === 401) {
					readyState = CLOSED;
					closed = true;
					notifySessionExpired();
					return;
				}
				if (!res.ok || !res.body) {
					throw new NetworkError(`SSE connect failed with status ${res.status}`);
				}

				readyState = OPEN;
				source.onopen?.();
				await consume(res.body);
				// Server closed the stream cleanly — treat as reconnectable
			} catch (err) {
				if (closed) return;
				source.onerror?.(err);
			}

			if (closed) return;
			if (Date.now() - connectedAt > STABLE_RESET_MS) backoffMs = BACKOFF_MIN_MS;
			const base = serverRetryMs ?? backoffMs;
			const jitter = base * 0.2 * (Math.random() * 2 - 1);
			const delay = Math.max(0, Math.min(base + jitter, BACKOFF_MAX_MS));
			backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
			try {
				await new Promise<void>((resolve, reject) => {
					const t = setTimeout(resolve, delay);
					abort.signal.addEventListener('abort', () => {
						clearTimeout(t);
						reject(new DOMException('Aborted', 'AbortError'));
					});
				});
			} catch {
				return; // closed during backoff
			}
		}
	}

	void run();
	return source;
}
