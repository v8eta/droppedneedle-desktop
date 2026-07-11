<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowUpCircle } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { API } from '$lib/constants';
	import { getApiUrl } from '$lib/api/api-utils';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { toastStore } from '$lib/stores/toast';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { CutoffUnmetItem, CutoffUnmetResponse } from '$lib/types';

	let items = $state<CutoffUnmetItem[]>([]);
	let loading = $state(true);
	let upgrading = $state<Set<string>>(new Set());

	async function load() {
		loading = true;
		try {
			const res = await api.global.get<CutoffUnmetResponse>(API.downloads.cutoffUnmet());
			items = res.items ?? [];
		} catch {
			items = [];
		}
		loading = false;
	}

	async function upgrade(item: CutoffUnmetItem) {
		upgrading = new Set(upgrading).add(item.release_group_mbid);
		try {
			await api.global.post(API.downloads.upgradeAlbum(), {
				release_group_mbid: item.release_group_mbid,
				artist_name: item.artist_name ?? '',
				album_title: item.album_title ?? '',
				year: item.year,
				artist_mbid: item.artist_mbid
			});
			toastStore.show({
				message: `Looking for a better copy of ${item.album_title}…`,
				type: 'info'
			});
			items = items.filter((i) => i.release_group_mbid !== item.release_group_mbid);
		} catch (err) {
			toastStore.show({
				message: err instanceof Error ? err.message : 'Upgrade failed.',
				type: 'error'
			});
		} finally {
			const next = new Set(upgrading);
			next.delete(item.release_group_mbid);
			upgrading = next;
		}
	}

	onMount(() => {
		// Quality upgrades are a curator (admin/trusted) action.
		if (!authStore.isAdmin && !authStore.isTrusted) {
			void goto(resolve('/'));
			return;
		}
		void load();
	});
</script>

<div class="mx-auto w-full max-w-3xl px-4 py-8">
	<div class="mb-6 flex items-center gap-2">
		<ArrowUpCircle class="h-6 w-6 text-primary" aria-hidden="true" />
		<h1 class="text-2xl font-bold">Quality upgrades</h1>
	</div>
	<p class="mb-6 text-sm opacity-60">
		Albums in your library below your quality cutoff. Upgrading looks for a better copy and replaces
		it if found.
	</p>

	{#if loading}
		<span class="loading loading-dots loading-lg"></span>
	{:else if items.length === 0}
		<EmptyState
			icon={ArrowUpCircle}
			title="Everything meets your cutoff"
			description="No albums below your quality target — nothing to upgrade."
		/>
	{:else}
		<div class="flex flex-col gap-2">
			{#each items as item (item.release_group_mbid)}
				<div class="flex items-center gap-3 rounded-xl bg-base-200 p-3">
					<img
						class="h-12 w-12 flex-shrink-0 rounded bg-base-300 object-cover"
						src={getApiUrl(`/api/v1/covers/release-group/${item.release_group_mbid}?size=100`)}
						alt=""
						onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
					/>
					<a
						href={resolve('/album/[id]', { id: item.release_group_mbid })}
						class="min-w-0 flex-1 hover:underline"
					>
						<p class="line-clamp-1 text-sm font-medium">{item.album_title ?? 'Unknown album'}</p>
						<p class="line-clamp-1 text-xs opacity-60">
							{item.artist_name ?? ''}
							{#if item.year}· {item.year}{/if}
						</p>
					</a>
					<span class="badge badge-ghost badge-sm" title="current quality">{item.current_tier}</span
					>
					<button
						class="btn btn-primary btn-sm"
						disabled={upgrading.has(item.release_group_mbid)}
						onclick={() => void upgrade(item)}
					>
						{#if upgrading.has(item.release_group_mbid)}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Upgrade
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
