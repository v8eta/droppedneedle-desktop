<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$lib/api/client';
	import { getApiUrl } from '$lib/api/api-utils';
	import type { Album } from '$lib/types';

	// Minimal album stub: cards across the app link here; the full detail page
	// (tracks, editions, activity) arrives with a later milestone.
	const mbid = $derived(page.params.id ?? '');
	let album = $state<Album | null>(null);
	let failed = $state(false);

	$effect(() => {
		if (!mbid) return;
		album = null;
		failed = false;
		api.global
			.get<Album>(`/api/v1/albums/${mbid}`)
			.then((a) => (album = a))
			.catch(() => (failed = true));
	});
</script>

<div class="mx-auto w-full max-w-3xl px-4 py-8">
	{#if album}
		<div class="flex items-start gap-6">
			<img
				class="h-40 w-40 rounded-xl bg-base-300 object-cover"
				src={getApiUrl(`/api/v1/covers/release-group/${mbid}?size=250`)}
				alt=""
				onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
			/>
			<div>
				<h1 class="text-2xl font-bold">{album.title}</h1>
				{#if album.artist}<p class="opacity-70">{album.artist}</p>{/if}
				<p class="mt-4 text-sm opacity-50">
					Full album page (tracks, editions, live activity) is coming in a later milestone —
					request and monitor from Search and Downloads meanwhile.
				</p>
			</div>
		</div>
	{:else if failed}
		<p class="opacity-60">Couldn't load this album.</p>
	{:else}
		<span class="loading loading-dots"></span>
	{/if}
</div>
