<script lang="ts">
	import { resolve } from '$app/paths';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { profilesStore } from '$lib/desktop/profiles.svelte';
	import { logout } from '$lib/desktop/session';
	import { createEventSource, type FetchEventSource } from '$lib/desktop/sse';
	import { mediaUrl } from '$lib/desktop/media';
	import { onDestroy, onMount } from 'svelte';

	// Temporary home screen: proves the M1 auth loop and hosts the day-1
	// transport spike (SSE stream + dn:// media proxy) until the real shell
	// replaces it.

	let sse = $state<'connecting' | 'open' | 'closed'>('connecting');
	let events = $state<string[]>([]);
	let source: FetchEventSource | null = null;

	const SPIKE_EVENTS = [
		'auto_download_enqueued',
		'playlist_imported',
		'personal_mix_refreshed',
		'wanted_new_candidates',
		'concerts_new',
		'wanted_auto_dispatched',
		'wanted_fulfilled'
	];

	onMount(() => {
		source = createEventSource('/api/v1/following/events');
		source.onopen = () => {
			sse = 'open';
			events = [...events, `[open] connected at ${new Date().toLocaleTimeString()}`];
		};
		source.onerror = () => {
			sse = 'connecting';
			events = [...events, `[error] reconnecting at ${new Date().toLocaleTimeString()}`];
		};
		for (const name of SPIKE_EVENTS) {
			source.addEventListener(name, (e) => {
				events = [...events.slice(-49), `[${name}] ${e.data.slice(0, 200)}`];
			});
		}
	});

	onDestroy(() => {
		source?.close();
		sse = 'closed';
	});
</script>

<div class="min-h-screen bg-base-100 p-8">
	<div class="mx-auto flex max-w-3xl flex-col gap-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-semibold">DroppedNeedle Desktop</h1>
				{#if authStore.user}
					<p class="text-sm opacity-70">
						{profilesStore.active?.name} · signed in as {authStore.user.display_name}
						<span class="badge badge-outline badge-sm ml-1">{authStore.user.role}</span>
					</p>
				{/if}
			</div>
			<button class="btn btn-ghost btn-sm" onclick={() => void logout()}>Sign out</button>
		</div>

		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title text-base">
					Live events
					<span class="badge badge-sm {sse === 'open' ? 'badge-success' : 'badge-warning'}">
						{sse}
					</span>
				</h2>
				<p class="text-xs opacity-60">
					/api/v1/following/events over the Rust transport — transport spike surface.
				</p>
				<div class="max-h-64 overflow-y-auto font-mono text-xs">
					{#if events.length === 0}
						<p class="opacity-50">No events yet — the stream is quiet until the server emits one.</p>
					{/if}
					{#each events as line, i (i)}
						<div>{line}</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title text-base">Media proxy spike</h2>
				<p class="text-xs opacity-60">
					The avatar below loads an authenticated API image through the dn:// proxy. A broken
					image means the proxy needs work; a dimmed placeholder is fine if no avatar is set.
				</p>
				{#if authStore.user}
					<img
						class="h-16 w-16 rounded-full bg-base-300 object-cover"
						src={mediaUrl(`/api/v1/profile/avatar/${authStore.user.id}`)}
						alt="avatar spike"
						onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.2')}
					/>
				{/if}
			</div>
		</div>

		<p class="text-xs opacity-40">
			Milestone 1 scaffold — the management shell (search, downloads, held review) lands next.
			<a class="link" href={resolve('/connect')}>Server settings</a>
		</p>
	</div>
</div>
