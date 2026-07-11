<script lang="ts">
	import { onMount } from 'svelte';
	import { Search, Download, Disc3 } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { API } from '$lib/constants';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { downloadsActivity } from '$lib/stores/downloadsActivity.svelte';
	import { formatBytes } from '$lib/utils/formatting';
	import LibraryAlbumCard from '$lib/components/library/LibraryAlbumCard.svelte';
	import type { LibraryStats, LibraryAlbumSummary } from '$lib/types';

	let stats = $state<LibraryStats | null>(null);
	let recent = $state<LibraryAlbumSummary[]>([]);
	let query = $state('');

	function doSearch(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (q) void goto(`${resolve('/search')}?q=${encodeURIComponent(q)}`);
	}

	onMount(() => {
		void (async () => {
			try {
				stats = await api.global.get<LibraryStats>(API.library.stats());
				recent = stats.recently_added ?? [];
			} catch {
				/* dashboard is best-effort */
			}
		})();
	});
</script>

<div class="mx-auto w-full max-w-6xl px-4 py-10">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">
			{#if authStore.user}Welcome back, {authStore.user.display_name}.{:else}DroppedNeedle{/if}
		</h1>
		<p class="mt-1 text-sm opacity-60">Request music, watch it land, keep your library close.</p>
	</div>

	<form class="mb-8 flex max-w-xl gap-2" onsubmit={doSearch}>
		<label class="input input-bordered flex flex-1 items-center gap-2">
			<Search class="h-4 w-4 opacity-50" />
			<input type="search" placeholder="Search an artist or album to request…" bind:value={query} />
		</label>
		<button class="btn btn-primary" type="submit">Search</button>
	</form>

	<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<a href={resolve('/downloads')} class="stat rounded-xl bg-base-200 transition hover:bg-base-300">
			<div class="stat-figure text-primary"><Download class="h-6 w-6" /></div>
			<div class="stat-title">Downloading</div>
			<div class="stat-value text-2xl">{downloadsActivity.count}</div>
		</a>
		{#if stats}
			<div class="stat rounded-xl bg-base-200">
				<div class="stat-figure text-accent"><Disc3 class="h-6 w-6" /></div>
				<div class="stat-title">Albums</div>
				<div class="stat-value text-2xl">{stats.total_albums}</div>
			</div>
			<div class="stat rounded-xl bg-base-200">
				<div class="stat-title">Tracks</div>
				<div class="stat-value text-2xl">{stats.total_tracks}</div>
			</div>
			<div class="stat rounded-xl bg-base-200">
				<div class="stat-title">Library size</div>
				<div class="stat-value text-2xl">{formatBytes(stats.total_size_bytes)}</div>
			</div>
		{/if}
	</div>

	{#if recent.length > 0}
		<section>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Recently added</h2>
				<a class="link text-sm" href={resolve('/library')}>All library →</a>
			</div>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
				{#each recent.slice(0, 12) as album (album.release_group_mbid)}
					<LibraryAlbumCard {album} />
				{/each}
			</div>
		</section>
	{/if}
</div>
