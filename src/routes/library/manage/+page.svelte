<script lang="ts">
	import { onMount } from 'svelte';
	import { ScanLine, RotateCcw, FileQuestion } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { API } from '$lib/constants';
	import { authStore } from '$lib/stores/authStore.svelte';
	import LibraryScanProgress from '$lib/components/library/LibraryScanProgress.svelte';
	import type { LibraryScanStatus, ManualReviewEntry } from '$lib/types';

	let busy = $state(false);
	let unmatchedCount = $state(0);

	async function refreshUnmatched() {
		try {
			const res = await api.global.get<{ items: ManualReviewEntry[] }>(API.library.unmatched());
			unmatchedCount = res.items?.length ?? 0;
		} catch {
			unmatchedCount = 0;
		}
	}

	async function startScan(force = false) {
		busy = true;
		try {
			const url = force ? `${API.library.scanStart()}?force=true` : API.library.scanStart();
			await api.global.post(url, {});
		} catch {
			/* the progress component surfaces errors */
		}
		busy = false;
	}

	async function cancelScan() {
		busy = true;
		try {
			await api.global.post(API.library.scanCancel(), {});
		} catch {
			/* best-effort */
		}
		busy = false;
	}

	onMount(() => {
		if (!authStore.isAdmin) {
			void goto(resolve('/library'));
			return;
		}
		void refreshUnmatched();
	});
</script>

<div class="mx-auto w-full max-w-3xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<ScanLine class="h-6 w-6 text-primary" aria-hidden="true" />
			<h1 class="text-2xl font-bold">Library management</h1>
		</div>
		<a class="btn btn-ghost btn-sm" href={resolve('/library')}>← Library</a>
	</div>

	<div class="card mb-6 bg-base-200">
		<div class="card-body gap-4">
			<h2 class="card-title text-base">Scan</h2>
			<p class="text-sm opacity-60">
				A scan reconciles the library with what's on disk. A force scan re-identifies every file and
				clears the MusicBrainz cache — slower, use it after fixing tags or paths.
			</p>
			<div class="flex flex-wrap gap-2">
				<button
					class="btn btn-primary btn-sm"
					disabled={busy}
					onclick={() => void startScan(false)}
				>
					<ScanLine class="h-4 w-4" /> Scan now
				</button>
				<button class="btn btn-sm" disabled={busy} onclick={() => void startScan(true)}>
					<RotateCcw class="h-4 w-4" /> Force re-scan
				</button>
				<button class="btn btn-ghost btn-sm" disabled={busy} onclick={() => void cancelScan()}>
					Cancel
				</button>
			</div>
			<LibraryScanProgress />
		</div>
	</div>

	<div class="card bg-base-200">
		<div class="card-body gap-3">
			<h2 class="card-title text-base">
				<FileQuestion class="h-5 w-5" /> Unmatched files
				{#if unmatchedCount > 0}<span class="badge badge-warning badge-sm">{unmatchedCount}</span
					>{/if}
			</h2>
			{#if unmatchedCount === 0}
				<p class="text-sm opacity-60">
					No unmatched files — everything on disk mapped to a release.
				</p>
			{:else}
				<p class="text-sm opacity-70">
					{unmatchedCount} file{unmatchedCount === 1 ? '' : 's'} couldn't be matched to a MusicBrainz
					release. Resolving each one (picking the right release) is best done in the web UI's unmatched
					matcher for now.
				</p>
			{/if}
		</div>
	</div>
</div>
