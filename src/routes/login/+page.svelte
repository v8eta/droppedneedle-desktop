<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ApiError, api } from '$lib/api/client';
	import { profilesStore } from '$lib/desktop/profiles.svelte';
	import { login } from '$lib/desktop/session';
	import { AUTH_ENDPOINTS } from '$lib/queries/auth/endpoints';
	import type { AuthProviders } from '$lib/queries/auth/types';
	import { onMount } from 'svelte';

	let username = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let retryAfter = $state(0);
	let providers = $state<AuthProviders | null>(null);

	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		await profilesStore.init();
		if (!profilesStore.active) {
			await goto(resolve('/connect'));
			return;
		}
		try {
			providers = await api.global.get<AuthProviders>(AUTH_ENDPOINTS.providers);
		} catch {
			providers = null; // best-effort; local form still shown
		}
		return () => {
			if (countdownTimer) clearInterval(countdownTimer);
		};
	});

	function startCountdown(seconds: number) {
		retryAfter = seconds;
		if (countdownTimer) clearInterval(countdownTimer);
		countdownTimer = setInterval(() => {
			retryAfter -= 1;
			if (retryAfter <= 0 && countdownTimer) clearInterval(countdownTimer);
		}, 1000);
	}

	async function submit() {
		error = null;
		busy = true;
		try {
			await login(username, password);
			await goto(resolve('/'));
		} catch (err) {
			if (err instanceof ApiError && err.status === 429) {
				const details = err.details as { retry_after?: number } | null;
				startCountdown(details?.retry_after ?? 10);
				error = 'Too many attempts — the server is rate-limiting logins.';
			} else if (err instanceof ApiError && err.status === 401) {
				error = 'Invalid username or password.';
			} else {
				error = err instanceof Error ? err.message : 'Sign-in failed.';
			}
		} finally {
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

			<form
				class="flex flex-col gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					void submit();
				}}
			>
				<label class="form-control">
					<span class="label-text mb-1">Username</span>
					<input
						type="text"
						class="input input-bordered w-full"
						bind:value={username}
						autocomplete="username"
						spellcheck="false"
					/>
				</label>
				<label class="form-control">
					<span class="label-text mb-1">Password</span>
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

			{#if error}
				<div class="alert alert-error text-sm">{error}</div>
			{/if}

			{#if providers && (providers.plex || providers.jellyfin || providers.oidc)}
				<div class="divider text-xs opacity-60">also enabled on this server</div>
				<div class="flex flex-col gap-2 text-sm opacity-70">
					{#if providers.plex}<span>Plex sign-in — coming in this milestone</span>{/if}
					{#if providers.jellyfin}<span>Jellyfin sign-in — coming in this milestone</span>{/if}
					{#if providers.oidc}
						<span>OIDC/SSO requires a browser — use the web UI, or a local account here.</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
