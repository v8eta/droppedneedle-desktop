<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { api } from '$lib/api/client';
	import { API } from '$lib/constants';
	import { getApiUrl } from '$lib/api/api-utils';
	import { formatDuration } from '$lib/utils/formatting';
	import { isActiveDownloadStatus } from '$lib/queries/downloads/downloadStatus';
	import AlbumRequestButton from '$lib/components/AlbumRequestButton.svelte';
	import AlbumDownloadStatus from '$lib/components/downloads/AlbumDownloadStatus.svelte';
	import type { Album, AlbumTracksInfo, DownloadListResponse, DownloadTask } from '$lib/types';

	const mbid = $derived(page.params.id ?? '');

	let album = $state<Album | null>(null);
	let tracks = $state<AlbumTracksInfo | null>(null);
	let activity = $state<DownloadTask[]>([]);
	let failed = $state(false);
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	async function loadActivity() {
		if (!mbid) return;
		try {
			const res = await api.global.get<DownloadListResponse>(
				API.downloads.list(undefined, 1, 100, mbid)
			);
			activity = res.items ?? [];
		} catch {
			activity = [];
		}
		// Poll faster while a task is in flight, then stop (mirrors upstream album view).
		const anyActive = activity.some((t) => isActiveDownloadStatus(t.status));
		if (anyActive && !pollTimer) {
			pollTimer = setInterval(() => void loadActivity(), 2500);
		} else if (!anyActive && pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	$effect(() => {
		const id = mbid;
		if (!id) return;
		album = null;
		tracks = null;
		failed = false;
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
		void api.global
			.get<Album>(API.album.basic(id))
			.then((a) => (album = a))
			.catch(() => (failed = true));
		void api.global
			.get<AlbumTracksInfo>(API.album.tracks(id))
			.then((t) => (tracks = t))
			.catch(() => {});
		void loadActivity();
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});
</script>

<div class="mx-auto w-full max-w-4xl px-4 py-8">
	{#if failed}
		<p class="opacity-60">Couldn't load this album.</p>
	{:else if !album}
		<span class="loading loading-dots loading-lg"></span>
	{:else}
		<div class="flex flex-col gap-6 sm:flex-row sm:items-start">
			<img
				class="h-48 w-48 flex-shrink-0 rounded-xl bg-base-300 object-cover shadow-lg"
				src={getApiUrl(`/api/v1/covers/release-group/${mbid}?size=500`)}
				alt=""
				onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
			/>
			<div class="flex-1">
				<h1 class="text-3xl font-bold">{album.title}</h1>
				{#if album.artist}<p class="mt-1 text-lg opacity-70">{album.artist}</p>{/if}
				<div class="mt-2 flex flex-wrap items-center gap-2 text-sm opacity-60">
					{#if album.year}<span>{album.year}</span>{/if}
					{#if album.track_count}<span>· {album.track_count} tracks</span>{/if}
					{#if album.in_library}<span class="badge badge-success badge-sm">In library</span>{/if}
					{#if album.type_info}<span class="badge badge-ghost badge-sm">{album.type_info}</span>{/if}
				</div>
				<div class="mt-4">
					<AlbumRequestButton
						mbid={album.musicbrainz_id}
						albumName={album.title}
						artistName={album.artist ?? ''}
						year={album.year ?? undefined}
						size="md"
					/>
				</div>
			</div>
		</div>

		{#if activity.length > 0}
			<section class="mt-8">
				<h2 class="mb-3 text-lg font-semibold">Activity</h2>
				<div class="flex flex-col gap-2">
					{#each activity as task (task.id)}
						<AlbumDownloadStatus {task} />
					{/each}
				</div>
			</section>
		{/if}

		{#if tracks && tracks.tracks.length > 0}
			<section class="mt-8">
				<h2 class="mb-3 text-lg font-semibold">
					Tracks
					<span class="text-sm font-normal opacity-50">({tracks.total_tracks})</span>
				</h2>
				<div class="overflow-hidden rounded-xl bg-base-200">
					{#each tracks.tracks as track (`${track.disc_number ?? 1}-${track.position}`)}
						<div class="flex items-center gap-3 border-b border-base-300 px-4 py-2 last:border-0">
							<span class="w-6 text-right text-sm tabular-nums opacity-40">{track.position}</span>
							<span class="flex-1 truncate text-sm">{track.title}</span>
							{#if track.length}
								<span class="text-xs tabular-nums opacity-50">{formatDuration(track.length)}</span>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<p class="mt-8 text-xs opacity-40">
			<a class="link" href={resolve('/library')}>← Library</a>
		</p>
	{/if}
</div>
