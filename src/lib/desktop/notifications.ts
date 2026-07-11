import { isTauri } from '@tauri-apps/api/core';
import { api } from '$lib/api/client';
import { API } from '$lib/constants';
import { toastStore } from '$lib/stores/toast';
import { authStore } from '$lib/stores/authStore.svelte';
import { invalidateQueriesWithPersister } from '$lib/queries/QueryClient';
import { LibraryQueryKeyFactory } from '$lib/queries/library/LibraryQueryKeyFactory';
import { isActiveDownloadStatus } from '$lib/queries/downloads/downloadStatus';
import { setTrayStatus } from '$lib/desktop/tray';
import type { DownloadListResponse, DownloadStatus, HeldListResponse } from '$lib/types';

/**
 * The native payoff layer: mirrors the app's toasts to Windows notifications
 * when the window isn't focused, and runs a poll-diff watcher that surfaces the
 * events the web UI has no notification for — a download landing, a download
 * failing for good, and (highest value) a track held for your review.
 *
 * All user-facing messages flow through toastStore, so the OS-notification
 * bridge is a single subscription; the watcher just calls toastStore.show().
 */

export interface NotificationPrefs {
	downloads: boolean; // completed / failed
	held: boolean; // "needs your ear"
	releases: boolean; // following events (auto-download, wanted-fulfilled)
}

const PREFS_KEY = 'msr:desktop_notification_prefs';

export function loadNotificationPrefs(): NotificationPrefs {
	const fallback: NotificationPrefs = { downloads: true, held: true, releases: true };
	try {
		const raw = localStorage.getItem(PREFS_KEY);
		return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<NotificationPrefs>) } : fallback;
	} catch {
		return fallback;
	}
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
	try {
		localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
	} catch {
		// non-critical
	}
}

let prefs = loadNotificationPrefs();
export function setNotificationPrefs(next: NotificationPrefs): void {
	prefs = next;
	saveNotificationPrefs(next);
}

// ---- OS notification bridge -------------------------------------------------

let permissionReady = false;

async function ensurePermission(): Promise<boolean> {
	if (!isTauri()) return false;
	if (permissionReady) return true;
	try {
		const { isPermissionGranted, requestPermission } = await import(
			'@tauri-apps/plugin-notification'
		);
		let granted = await isPermissionGranted();
		if (!granted) granted = (await requestPermission()) === 'granted';
		permissionReady = granted;
		return granted;
	} catch {
		return false;
	}
}

async function windowFocused(): Promise<boolean> {
	if (!isTauri()) return true;
	try {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		return await getCurrentWindow().isFocused();
	} catch {
		return true; // assume focused (suppress) on any error
	}
}

async function notify(title: string, body: string): Promise<void> {
	if (!(await ensurePermission())) return;
	if (await windowFocused()) return; // don't double-notify a visible window
	try {
		const { sendNotification } = await import('@tauri-apps/plugin-notification');
		sendNotification({ title, body });
	} catch {
		// notification unavailable — the in-app toast already fired
	}
}

// ---- poll-diff watcher ------------------------------------------------------

let queueTimer: ReturnType<typeof setInterval> | null = null;
let heldTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeToasts: (() => void) | null = null;
let prevStatus = new Map<string, DownloadStatus>();
let knownHeld = new Set<number>();
let primed = false; // first poll seeds baselines without notifying

async function pollQueue(): Promise<void> {
	let res: DownloadListResponse;
	try {
		res = await api.global.get<DownloadListResponse>(API.downloads.list(undefined, 1, 100));
	} catch {
		return;
	}
	const items = res.items ?? [];
	const active = items.filter((t) => isActiveDownloadStatus(t.status)).length;
	void setTrayStatus({ active, held: knownHeld.size });

	if (primed) {
		// OS-notify only: the Downloads screen is the in-app surface for these,
		// and going through toastStore would double-fire via the toast→OS bridge.
		for (const t of items) {
			const prev = prevStatus.get(t.id);
			if (prev === undefined || !isActiveDownloadStatus(prev)) continue;
			if (!prefs.downloads) continue;
			if (t.status === 'completed' || t.status === 'partial') {
				const name = t.album_title || 'An album';
				void notify('Download complete', `${name} landed in your library.`);
			} else if (t.status === 'failed') {
				const name = t.album_title || 'A download';
				void notify('Download failed', `${name} failed after all retries.`);
			}
		}
		if (items.some((t) => t.status === 'completed' || t.status === 'partial')) {
			void invalidateQueriesWithPersister({ queryKey: LibraryQueryKeyFactory.all });
		}
	}
	prevStatus = new Map(items.map((t) => [t.id, t.status]));
}

async function pollHeld(): Promise<void> {
	let res: HeldListResponse;
	try {
		res = await api.global.get<HeldListResponse>(API.downloads.held());
	} catch {
		return;
	}
	const items = res.items ?? [];
	const ids = new Set(items.map((h) => h.id));
	if (primed) {
		// OS-notify only (see pollQueue) — the held section on Downloads is the in-app surface.
		for (const h of items) {
			if (knownHeld.has(h.id)) continue;
			if (!prefs.held) continue;
			const track = h.track_title || h.original_filename || 'A track';
			void notify('Needs your review', `Couldn't verify ${track} — check the audio.`);
		}
	}
	knownHeld = ids;
	void setTrayStatus({ held: ids.size });
}

/** Start the OS-notification bridge + poll-diff watcher. Idempotent. */
export function startNotifications(): void {
	if (queueTimer || heldTimer) return;
	primed = false;
	// Prime baselines on the first tick, then notify on subsequent diffs so a
	// relaunch doesn't replay every in-flight download / held item as "new".
	void (async () => {
		await Promise.allSettled([pollQueue(), pollHeld()]);
		primed = true;
	})();
	queueTimer = setInterval(() => void pollQueue(), 15_000);
	heldTimer = setInterval(() => void pollHeld(), 30_000);

	// Mirror success/info toasts raised elsewhere (FollowingEvents' wanted-fulfilled /
	// auto-download / new-release) to an OS notification when unfocused. The poll-diff
	// watcher deliberately does NOT route through toastStore, so this only ever sees
	// following-originated toasts (no double-fire). Store the unsubscribe so a
	// logout→login cycle doesn't stack duplicate subscriptions.
	unsubscribeToasts = toastStore.subscribe((toast) => {
		if (!toast || !prefs.releases) return;
		if (toast.type === 'error') return; // errors stay in-app
		void notify('DroppedNeedle', toast.message);
	});
}

export function stopNotifications(): void {
	if (queueTimer) clearInterval(queueTimer);
	if (heldTimer) clearInterval(heldTimer);
	queueTimer = heldTimer = null;
	unsubscribeToasts?.();
	unsubscribeToasts = null;
	prevStatus = new Map();
	knownHeld = new Set();
	primed = false;
	void setTrayStatus({ active: 0, held: 0 });
}
