<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import QueryProvider from '$lib/queries/QueryProvider.svelte';
	import Topbar from '$lib/desktop/Topbar.svelte';
	import { initSessionEvents, restore } from '$lib/desktop/session';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { downloadsActivity } from '$lib/stores/downloadsActivity.svelte';
	import { integrationStore } from '$lib/stores/integration';
	import { createFollowingEvents } from '$lib/queries/following/FollowingEvents';
	import { startNotifications, stopNotifications } from '$lib/desktop/notifications';
	import { initTrayNavigation } from '$lib/desktop/tray';

	let { children } = $props();

	const BARE_ROUTES = ['/connect', '/login'];
	const showChrome = $derived(
		authStore.isAuthenticated && !BARE_ROUTES.includes(page.url.pathname)
	);

	const followingEvents = createFollowingEvents();
	let backgroundRunning = false;

	$effect(() => {
		if (authStore.isAuthenticated) {
			if (!backgroundRunning) {
				backgroundRunning = true;
				downloadsActivity.start();
				void integrationStore.ensureLoaded();
				followingEvents.start();
				startNotifications();
			}
		} else if (backgroundRunning) {
			backgroundRunning = false;
			downloadsActivity.stop();
			followingEvents.stop();
			stopNotifications();
		}
	});

	let booted = $state(false);
	let unreachable = $state(false);
	let retrying = $state(false);

	async function boot() {
		unreachable = false;
		const result = await restore();
		if (result === 'no-profile') {
			await goto(resolve('/connect'));
		} else if (result === 'login') {
			await goto(resolve('/login'));
		} else if (result === 'unreachable') {
			unreachable = true;
		}
		booted = true;
	}

	async function retry() {
		retrying = true;
		try {
			await boot();
		} finally {
			retrying = false;
		}
	}

	onMount(() => {
		initSessionEvents();
		void initTrayNavigation((path) => void goto(resolve(path as '/downloads')));
		void boot();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if !booted}
	<div class="flex h-screen items-center justify-center bg-base-100">
		<span class="loading loading-ring loading-lg text-primary"></span>
	</div>
{:else if unreachable}
	<div class="flex h-screen flex-col items-center justify-center gap-4 bg-base-100">
		<h1 class="text-xl font-semibold">Server unreachable</h1>
		<p class="max-w-md text-center text-sm opacity-70">
			Couldn't reach your DroppedNeedle server. Check the network (or VPN) and try again.
		</p>
		<div class="flex gap-2">
			<button class="btn btn-primary" onclick={retry} disabled={retrying}>
				{#if retrying}<span class="loading loading-spinner loading-sm"></span>{/if}
				Retry
			</button>
			<a class="btn btn-ghost" href={resolve('/connect')}>Change server</a>
		</div>
	</div>
{:else}
	<QueryProvider>
		{#if showChrome}
			<Topbar />
		{/if}
		{@render children()}
	</QueryProvider>
{/if}
