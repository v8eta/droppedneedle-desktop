<script lang="ts">
	import { onMount } from 'svelte';
	import { Heart, Disc3, ArrowRight } from 'lucide-svelte';
	import { api } from '$lib/api/client';
	import { API } from '$lib/constants';
	import { getApiUrl } from '$lib/api/api-utils';
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { FollowedArtist, NewRelease, NewReleasesResponse } from '$lib/queries/following/types';

	let artists = $state<FollowedArtist[]>([]);
	let releases = $state<NewRelease[]>([]);
	let loading = $state(true);

	async function load() {
		loading = true;
		const [a, r] = await Promise.allSettled([
			api.global.get<FollowedArtist[]>(API.following.artists()),
			api.global.get<NewReleasesResponse>(API.following.newReleases(24, 0))
		]);
		if (a.status === 'fulfilled') artists = a.value;
		if (r.status === 'fulfilled') releases = r.value.items;
		loading = false;
		// clear the unseen badge now that the user is looking
		try {
			await api.global.post(API.following.markNewReleasesSeen());
		} catch {
			/* best-effort */
		}
	}

	onMount(() => void load());
</script>

<div class="mx-auto w-full max-w-5xl px-4 py-8">
	<div class="mb-6 flex items-center gap-2">
		<Heart class="h-6 w-6 text-primary" aria-hidden="true" />
		<h1 class="text-2xl font-bold">Following</h1>
	</div>

	{#if loading}
		<span class="loading loading-dots loading-lg"></span>
	{:else if artists.length === 0 && releases.length === 0}
		<EmptyState
			icon={Heart}
			title="Not following anyone yet"
			description="Follow an artist from search to get new-release alerts here."
		/>
	{:else}
		{#if releases.length > 0}
			<section class="mb-8">
				<h2 class="mb-3 text-lg font-semibold">New releases</h2>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{#each releases as r (r.release_group_mbid)}
						<a
							class="card bg-base-200 transition hover:bg-base-300"
							href={resolve('/album/[id]', { id: r.release_group_mbid })}
						>
							<figure class="aspect-square">
								<img
									class="h-full w-full object-cover"
									src={getApiUrl(`/api/v1/covers/release-group/${r.release_group_mbid}?size=250`)}
									alt=""
									onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
								/>
							</figure>
							<div class="card-body p-3">
								<p class="line-clamp-1 text-sm font-medium">{r.title}</p>
								<p class="line-clamp-1 text-xs opacity-60">{r.artist_name}</p>
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<h2 class="mb-3 text-lg font-semibold">Artists ({artists.length})</h2>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{#each artists as a (a.mbid)}
					<a
						class="flex items-center gap-3 rounded-xl bg-base-200 p-3 transition hover:bg-base-300"
						href={resolve('/artist/[id]', { id: a.mbid })}
					>
						<img
							class="h-12 w-12 rounded-full bg-base-300 object-cover"
							src={getApiUrl(`/api/v1/covers/artist/${a.mbid}?size=100`)}
							alt=""
							onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
						/>
						<div class="min-w-0 flex-1">
							<p class="line-clamp-1 text-sm font-medium">{a.name}</p>
							{#if a.auto_download}
								<span class="badge badge-accent badge-xs">auto-download</span>
							{/if}
						</div>
						<ArrowRight class="h-4 w-4 opacity-40" />
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>
