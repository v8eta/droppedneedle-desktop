<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { api } from '$lib/api/client';
	import { API } from '$lib/constants';
	import { getApiUrl } from '$lib/api/api-utils';
	import FollowControl from '$lib/components/FollowControl.svelte';
	import AlbumRequestButton from '$lib/components/AlbumRequestButton.svelte';
	import type { Artist, ArtistReleases, ReleaseGroup } from '$lib/types';

	const mbid = $derived(page.params.id ?? '');

	let artist = $state<Artist | null>(null);
	let releases = $state<ArtistReleases | null>(null);
	let failed = $state(false);

	// Albums first, then EPs, then singles — the useful order for requesting.
	const groups = $derived.by(() => {
		if (!releases) return [] as { label: string; items: ReleaseGroup[] }[];
		return [
			{ label: 'Albums', items: releases.albums },
			{ label: 'EPs', items: releases.eps },
			{ label: 'Singles', items: releases.singles }
		].filter((g) => g.items.length > 0);
	});

	$effect(() => {
		const id = mbid;
		if (!id) return;
		artist = null;
		releases = null;
		failed = false;
		void api.global
			.get<Artist>(API.artist.basic(id))
			.then((a) => (artist = a))
			.catch(() => (failed = true));
		void api.global
			.get<ArtistReleases>(API.artist.releases(id, 0, 100))
			.then((r) => (releases = r))
			.catch(() => {});
	});
</script>

<div class="mx-auto w-full max-w-4xl px-4 py-8">
	{#if failed}
		<p class="opacity-60">Couldn't load this artist.</p>
	{:else if !artist}
		<span class="loading loading-dots loading-lg"></span>
	{:else}
		<div class="flex flex-col gap-6 sm:flex-row sm:items-start">
			<img
				class="h-40 w-40 flex-shrink-0 rounded-full bg-base-300 object-cover shadow-lg"
				src={getApiUrl(`/api/v1/covers/artist/${mbid}?size=500`)}
				alt=""
				onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
			/>
			<div class="flex-1">
				<h1 class="text-3xl font-bold">{artist.title}</h1>
				<div class="mt-2 flex flex-wrap items-center gap-2 text-sm opacity-60">
					{#if artist.in_library}<span class="badge badge-success badge-sm">In library</span>{/if}
					{#if artist.disambiguation}<span>{artist.disambiguation}</span>{/if}
				</div>
				<div class="mt-4">
					<FollowControl artistMbid={mbid} />
				</div>
			</div>
		</div>

		{#if groups.length > 0}
			{#each groups as group (group.label)}
				<section class="mt-8">
					<h2 class="mb-3 text-lg font-semibold">{group.label}</h2>
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						{#each group.items as rg (rg.id)}
							<div class="card bg-base-200">
								<a href={resolve('/album/[id]', { id: rg.id })}>
									<figure class="aspect-square">
										<img
											class="h-full w-full object-cover"
											src={getApiUrl(`/api/v1/covers/release-group/${rg.id}?size=250`)}
											alt=""
											onerror={(e) =>
												((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
										/>
									</figure>
								</a>
								<div class="card-body gap-2 p-3">
									<a
										href={resolve('/album/[id]', { id: rg.id })}
										class="line-clamp-1 text-sm font-medium hover:underline"
									>
										{rg.title}
									</a>
									<div class="flex items-center justify-between">
										<span class="text-xs opacity-50">{rg.year ?? ''}</span>
										{#if rg.in_library}
											<span class="badge badge-success badge-xs">In library</span>
										{:else}
											<AlbumRequestButton
												mbid={rg.id}
												albumName={rg.title}
												artistName={artist.title}
												year={rg.year}
												artistMbid={mbid}
												size="sm"
											/>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		{/if}

		<p class="mt-8 text-xs opacity-40">
			<a class="link" href={resolve('/following')}>← Following</a>
		</p>
	{/if}
</div>
