<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$lib/api/client';
	import { getApiUrl } from '$lib/api/api-utils';
	import type { Artist } from '$lib/types';

	// Minimal artist stub: cards across the app link here; the full artist page
	// (releases, follow controls, similar) arrives with a later milestone.
	const mbid = $derived(page.params.id ?? '');
	let artist = $state<Artist | null>(null);
	let failed = $state(false);

	$effect(() => {
		if (!mbid) return;
		artist = null;
		failed = false;
		api.global
			.get<Artist>(`/api/v1/artists/${mbid}`)
			.then((a) => (artist = a))
			.catch(() => (failed = true));
	});
</script>

<div class="mx-auto w-full max-w-3xl px-4 py-8">
	{#if artist}
		<div class="flex items-start gap-6">
			<img
				class="h-40 w-40 rounded-full bg-base-300 object-cover"
				src={getApiUrl(`/api/v1/covers/artist/${mbid}?size=250`)}
				alt=""
				onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
			/>
			<div>
				<h1 class="text-2xl font-bold">{artist.title}</h1>
				<p class="mt-4 text-sm opacity-50">
					Full artist page (discography, follow controls) is coming in a later milestone.
				</p>
			</div>
		</div>
	{:else if failed}
		<p class="opacity-60">Couldn't load this artist.</p>
	{:else}
		<span class="loading loading-dots"></span>
	{/if}
</div>
