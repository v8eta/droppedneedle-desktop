import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { api } from '$lib/api/client';
import { AUTH_ENDPOINTS } from '$lib/queries/auth/endpoints';
import type { AuthSessionUser } from '$lib/queries/auth/types';
import { toAuthUser } from '$lib/queries/auth/types';
import { resetQueryCacheForUserSwitch } from '$lib/queries/QueryClient';
import { authStore, LAST_USER_ID_KEY } from '$lib/stores/authStore.svelte';
import { clearConnection, setConnection } from '$lib/desktop/connection';
import { profilesStore } from '$lib/desktop/profiles.svelte';
import { secretDelete, secretGet, secretSet } from '$lib/desktop/secrets';
import { onSessionExpired } from '$lib/desktop/sessionEvents';
import { clearUserScopedLocalCaches } from '$lib/utils/userScopedCaches';

/**
 * Session lifecycle for the desktop client. DroppedNeedle issues a 30-day,
 * non-renewing bearer token from POST /auth/login; there is no refresh —
 * a 401 anywhere means the session is gone and we return to /login.
 */

/** The login/setup endpoints return the raw token alongside the user.
 *  Upstream's AuthSessionResponse omits `token` because the web UI rides the
 *  cookie; the desktop client captures it. */
export interface DesktopAuthResponse {
	token: string;
	user: AuthSessionUser;
}

export type RestoreResult = 'ok' | 'login' | 'unreachable' | 'no-profile';

let expiring = false;

/** Wire the 401 → expire() path once at app startup. */
export function initSessionEvents(): void {
	onSessionExpired(() => void expire());
}

/** Activate a profile's connection info (no auth check). */
async function activateProfileConnection(token: string | null): Promise<void> {
	const profile = profilesStore.active;
	if (!profile) return;
	await setConnection({
		baseUrl: profile.baseUrl,
		token,
		acceptInvalidCerts: profile.acceptInvalidCerts
	});
}

/** Try to restore the previous session for the active profile. */
export async function restore(): Promise<RestoreResult> {
	await profilesStore.init();
	const profile = profilesStore.active;
	if (!profile) return 'no-profile';

	const token = await secretGet(profile.id);
	if (!token) {
		await activateProfileConnection(null);
		return 'login';
	}
	await activateProfileConnection(token);

	try {
		const me = await api.global.get<AuthSessionUser>('/api/v1/auth/me');
		authStore.setUser(toAuthUser(me));
		authStore.markInitialized();
		expiring = false;
		await profilesStore.update(profile.id, {
			lastUser: { id: me.id, display_name: me.display_name, role: me.role },
			lastConnectedAt: new Date().toISOString()
		});
		return 'ok';
	} catch (err) {
		if (err instanceof Error && err.name === 'NetworkError') {
			// Server unreachable — keep the token, offer retry.
			return 'unreachable';
		}
		// 401 or anything else auth-shaped: drop the stored token.
		await secretDelete(profile.id);
		await setConnection({ token: null });
		return 'login';
	}
}

/** Local username/password login against the active profile. */
export async function login(username: string, password: string): Promise<void> {
	const profile = profilesStore.active;
	if (!profile) throw new Error('No active server profile');

	await activateProfileConnection(null);
	const resp = await api.global.post<DesktopAuthResponse>(AUTH_ENDPOINTS.login, {
		username,
		password
	});
	await completeLogin(resp);
}

/** Shared tail for every token-minting flow (local/jellyfin/plex/setup). */
export async function completeLogin(resp: DesktopAuthResponse): Promise<void> {
	const profile = profilesStore.active;
	if (!profile) throw new Error('No active server profile');

	await secretSet(profile.id, resp.token);
	await setConnection({ token: resp.token });
	await resetQueryCacheForUserSwitch();
	authStore.setUser(toAuthUser(resp.user));
	authStore.markInitialized();
	expiring = false;
	await profilesStore.update(profile.id, {
		lastUser: { id: resp.user.id, display_name: resp.user.display_name, role: resp.user.role },
		lastConnectedAt: new Date().toISOString()
	});
}

/**
 * Idempotent session teardown for a dead token (401). The first caller wins;
 * concurrent 401 bursts (pollers + SSE + mutations) are ignored.
 */
export async function expire(): Promise<void> {
	if (expiring) return;
	expiring = true;
	const profile = profilesStore.active;
	if (profile) {
		await secretDelete(profile.id).catch(() => {});
	}
	await setConnection({ token: null });
	authStore.clear();
	await resetQueryCacheForUserSwitch();
	await goto(resolve('/login'));
}

/** Explicit user-initiated logout: revoke server-side, then clear local state. */
export async function logout(): Promise<void> {
	try {
		await api.global.post('/api/v1/auth/logout');
	} catch {
		// A failed revoke must not strand the user in a signed-in UI.
	}
	const profile = profilesStore.active;
	if (profile) {
		await secretDelete(profile.id).catch(() => {});
	}
	await setConnection({ token: null });
	await resetQueryCacheForUserSwitch();
	clearUserScopedLocalCaches();
	localStorage.removeItem(LAST_USER_ID_KEY);
	authStore.clear();
	expiring = false;
	await goto(resolve('/login'));
}

/** Full disconnect: also forget the active profile selection. */
export async function disconnect(): Promise<void> {
	await logout().catch(() => {});
	await profilesStore.setActive(null);
	await clearConnection();
	await goto(resolve('/connect'));
}
