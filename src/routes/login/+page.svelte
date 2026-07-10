<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ApiError, api } from '$lib/api/client';
	import { profilesStore } from '$lib/desktop/profiles.svelte';
	import { completeLogin, login, type DesktopAuthResponse } from '$lib/desktop/session';
	import { AUTH_ENDPOINTS } from '$lib/queries/auth/endpoints';
	import type { AuthProviders, PlexPinResponse, PlexPollResponse } from '$lib/queries/auth/types';
	import { onDestroy, onMount } from 'svelte';

	type Tab = 'local' | 'plex' | 'jellyfin';

	let username = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let retryAfter = $state(0);
	let providers = $state<AuthProviders | null>(null);
	let tab = $state<Tab>('local');
	let plexWaiting = $state(false);

	let countdownTimer: ReturnType<typeof setInterval> | null = null;
	let plexAbort: AbortController | null = null;

	const availableTabs = $derived.by<Tab[]>(() => {
		if (!providers) return ['local'];
		const tabs: Tab[] = [];
		if (providers.local) tabs.push('local');
		if (providers.plex) tabs.push('plex');
		if (providers.jellyfin) tabs.push('jellyfin');
		return tabs.length > 0 ? tabs : ['local'];
	});

	onMount(() => {
		void (async () => {
			await profilesStore.init();
			if (!profilesStore.active) {
				await goto(resolve('/connect'));
				return;
			}
			try {
				providers = await api.global.get<AuthProviders>(AUTH_ENDPOINTS.providers);
				if (!availableTabs.includes(tab)) tab = availableTabs[0];
			} catch {
				providers = null; // best-effort; local form still shown
			}
		})();
		return () => {
			if (countdownTimer) clearInterval(countdownTimer);
		};
	});

	onDestroy(() => plexAbort?.abort());

	function startCountdown(seconds: number) {
		retryAfter = seconds;
		if (countdownTimer) clearInterval(countdownTimer);
		countdownTimer = setInterval(() => {
			retryAfter -= 1;
			if (retryAfter <= 0 && countdownTimer) clearInterval(countdownTimer);
		}, 1000);
	}

	function showError(err: unknown, fallback: string) {
		if (err instanceof ApiError && err.status === 429) {
			const details = err.details as { retry_after?: number } | null;
			startCountdown(details?.retry_after ?? 10);
			error = 'Too many attempts — the server is rate-limiting logins.';
		} else if (err instanceof ApiError && err.status === 401) {
			error = 'Invalid username or password.';
		} else {
			error = err instanceof Error ? err.message : fallback;
		}
	}

	async function submitLocal() {
		error = null;
		busy = true;
		try {
			await login(username, password);
			await goto(resolve('/'));
		} catch (err) {
			showError(err, 'Sign-in failed.');
		} finally {
			busy = false;
		}
	}

	async function submitJellyfin() {
		error = null;
		busy = true;
		try {
			const resp = await api.global.post<DesktopAuthResponse>(AUTH_ENDPOINTS.jellyfinLogin, {
				username,
				password
			});
			await completeLogin(resp);
			await goto(resolve('/'));
		} catch (err) {
			showError(err, 'Jellyfin sign-in failed.');
		} finally {
			busy = false;
		}
	}

	async function openExternal(url: string) {
		try {
			const { openUrl } = await import('@tauri-apps/plugin-opener');
			await openUrl(url);
		} catch {
			window.open(url, '_blank'); // browser-dev fallback
		}
	}

	async function startPlex() {
		error = null;
		busy = true;
		plexWaiting = false;
		plexAbort?.abort();
		plexAbort = new AbortController();
		const signal = plexAbort.signal;
		try {
			const pin = await api.global.post<PlexPinResponse>(AUTH_ENDPOINTS.plexPin);
			await openExternal(pin.auth_url);
			plexWaiting = true;
			const deadline = Date.now() + 5 * 60_000;
			while (Date.now() < deadline && !signal.aborted) {
				await new Promise((r) => setTimeout(r, 2000));
				if (signal.aborted) return;
				const poll = await api.global.get<PlexPollResponse & { token?: string }>(
					AUTH_ENDPOINTS.plexPoll(String(pin.pin_id)),
					{ signal }
				);
				if (poll.completed && poll.token && poll.user) {
					await completeLogin({ token: poll.token, user: poll.user });
					await goto(resolve('/'));
					return;
				}
			}
			if (!signal.aborted) error = 'Plex sign-in timed out — try again.';
		} catch (err) {
			if (!signal.aborted) showError(err, 'Plex sign-in failed.');
		} finally {
			plexWaiting = false;
			busy = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-base-100 p-6">
	<div class="card w-full max-w-md bg-base-200 shadow-xl">
		<div class="card-body gap-4">
			<h1 class="card-title text-2xl">Sign in</h1>
			{#if profilesStore.active}
				<p class="text-sm opacity-70">
					{profilesStore.active.name} · {profilesStore.active.baseUrl}
					<a class="link ml-1" href={resolve('/connect')}>change</a>
				</p>
			{/if}

			{#if availableTabs.length > 1}
				<div role="tablist" class="tabs-border tabs">
					{#each availableTabs as t (t)}
						<button
							role="tab"
							class="tab {tab === t ? 'tab-active' : ''}"
							onclick={() => {
								tab = t;
								error = null;
							}}
						>
							{t === 'local' ? 'Password' : t === 'plex' ? 'Plex' : 'Jellyfin'}
						</button>
					{/each}
				</div>
			{/if}

			{#if tab === 'plex'}
				<p class="text-sm opacity-70">
					Sign in through plex.tv in your browser; the app picks it up automatically.
				</p>
				<button class="btn btn-primary" onclick={() => void startPlex()} disabled={busy}>
					{#if plexWaiting}
						<span class="loading loading-spinner loading-sm"></span> Waiting for plex.tv…
					{:else if busy}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						Sign in with Plex
					{/if}
				</button>
			{:else}
				<form
					class="flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						void (tab === 'jellyfin' ? submitJellyfin() : submitLocal());
					}}
				>
					<label class="form-control">
						<span class="label-text mb-1">{tab === 'jellyfin' ? 'Jellyfin username' : 'Username'}</span>
						<input
							type="text"
							class="input input-bordered w-full"
							bind:value={username}
							autocomplete="username"
							spellcheck="false"
						/>
					</label>
					<label class="form-control">
						<span class="label-text mb-1">{tab === 'jellyfin' ? 'Jellyfin password' : 'Password'}</span>
						<input
							type="password"
							class="input input-bordered w-full"
							bind:value={password}
							autocomplete="current-password"
						/>
					</label>
					<button
						class="btn btn-primary"
						type="submit"
						disabled={busy || retryAfter > 0 || !username || !password}
					>
						{#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
						{retryAfter > 0 ? `Try again in ${retryAfter}s` : 'Sign in'}
					</button>
				</form>
			{/if}

			{#if error}
				<div class="alert alert-error text-sm">{error}</div>
			{/if}

			{#if providers?.oidc}
				<p class="text-xs opacity-60">
					This server also offers OIDC/SSO sign-in, which needs a browser — use the web UI for
					that, or a local account here.
				</p>
			{/if}
		</div>
	</div>
</div>
