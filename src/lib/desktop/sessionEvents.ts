/**
 * Tiny callback registry decoupling the API client (which detects 401s) from
 * the session module (which owns the logout/redirect flow). Avoids a circular
 * import between $lib/api/client and $lib/desktop/session.
 *
 * The notify path is idempotent-by-design: session.expire() ignores repeat
 * calls, so a burst of concurrent 401s (pollers + SSE + mutations when the
 * 30-day token dies) collapses into one expiry.
 */
type Handler = () => void;

let handler: Handler | null = null;

export function onSessionExpired(cb: Handler): void {
	handler = cb;
}

export function notifySessionExpired(): void {
	handler?.();
}
