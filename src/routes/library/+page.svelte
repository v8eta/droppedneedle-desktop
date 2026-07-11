<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowUpCircle, Library, RefreshCw, ScanLine, Search } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { api } from '$lib/api/client';
	import { API } from '$lib/constants';
	import { authStore } from '$lib/stores/authStore.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LibraryAlbumCard from '$lib/components/library/LibraryAlbumCard.svelte';
	import { formatBytes } from '$lib/utils/formatting';
	import type { LibraryStats, LibraryAlbumSummary, NativeAlbumsResponse } from '$lib/types';

	let stats = $state<LibraryStats | null>(null);
	let albums = $state<LibraryAlbumSummary[]>([]);
	let total = $state(0);
	let pageNum = $state(1);
	let sort = $state('recent');
	let query = $state('');
	let loading = $state(true);
	let syncing = $state(false);
	const pageSize = 48;

	async function loadStats() {
		try {
			stats = await api.global.get<LibraryStats>(API.library.stats());
		} catch {
			stats = null;
		}
	}

	async function loadAlbums() {
		loading = true;
		try {
			const res = await api.global.get<NativeAlbumsResponse>(
				API.library.albums(pageNum, sort, query || undefined, undefined, pageSize)
			);
			albums = res.items;
			total = res.total;
		} catch {
			albums = [];
			total = 0;
		}
		loading = false;
	}

	async function sync() {
		syncing = true;
		try {
			await api.global.post('/api/v1/library/sync');
			await Promise.all([loadStats(), loadAlbums()]);
		} catch {
			/* best-effort */
		}
		syncing = false;
	}

	function changeSort(next: string) {
		sort = next;
		pageNum = 1;
		void loadAlbums();
	}

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearch() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			pageNum = 1;
			void loadAlbums();
		}, 300);
	}

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	onMount(() => {
		void loadStats();
		void loadAlbums();
	});
</script>

<div class="mx-auto w-full max-w-6xl px-4 py-8">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			<Library class="h-6 w-6 text-primary" aria-hidden="true" />
			<h1 class="text-2xl font-bold">Library</h1>
		</div>
		<div class="flex gap-2">
			{#if authStore.isAdmin || authStore.isTrusted}
				<a class="btn btn-ghost btn-sm" href={resolve('/upgrades')}>
					<ArrowUpCircle class="h-4 w-4" /> Upgrades
				</a>
			{/if}
			{#if authStore.isAdmin}
				<a class="btn btn-ghost btn-sm" href={resolve('/library/manage')}>
					<ScanLine class="h-4 w-4" /> Manage
				</a>
			{/if}
			<button class="btn btn-sm" onclick={() => void sync()} disabled={syncing}>
				<RefreshCw class="h-4 w-4 {syncing ? 'animate-spin' : ''}" />
				Sync
			</button>
		</div>
	</div>

	{#if stats}
		<div class="stats mb-6 w-full bg-base-200 shadow">
			<div class="stat">
				<div class="stat-title">Albums</div>
				<div class="stat-value text-2xl">{stats.total_albums}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Artists</div>
				<div class="stat-value text-2xl">{stats.total_artists}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Tracks</div>
				<div class="stat-value text-2xl">{stats.total_tracks}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Size</div>
				<div class="stat-value text-2xl">{formatBytes(stats.total_size_bytes)}</div>
			</div>
		</div>
	{/if}

	<div class="mb-4 flex flex-wrap items-center gap-2">
		<label class="input input-sm input-bordered flex items-center gap-2">
			<Search class="h-4 w-4 opacity-50" />
			<input type="search" placeholder="Filter albums" bind:value={query} oninput={onSearch} />
		</label>
		<div class="join">
			{#each [['recent', 'Recent'], ['artist', 'Artist'], ['title', 'Title']] as [val, label] (val)}
				<button
					class="btn join-item btn-sm {sort === val ? 'btn-active' : ''}"
					onclick={() => changeSort(val)}>{label}</button
				>
			{/each}
		</div>
	</div>

	{#if loading}
		<span class="loading loading-dots loading-lg"></span>
	{:else if albums.length === 0}
		<EmptyState
			icon={Library}
			title="No albums"
			description={query
				? 'Nothing matches that filter.'
				: 'Request some music to fill your library.'}
		/>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{#each albums as album (album.release_group_mbid)}
				<LibraryAlbumCard {album} />
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="mt-6 flex items-center justify-center gap-2">
				<button
					class="btn btn-sm"
					disabled={pageNum <= 1}
					onclick={() => {
						pageNum -= 1;
						void loadAlbums();
					}}>Prev</button
				>
				<span class="text-sm opacity-60">Page {pageNum} / {totalPages}</span>
				<button
					class="btn btn-sm"
					disabled={pageNum >= totalPages}
					onclick={() => {
						pageNum += 1;
						void loadAlbums();
					}}>Next</button
				>
			</div>
		{/if}
	{/if}
</div>
