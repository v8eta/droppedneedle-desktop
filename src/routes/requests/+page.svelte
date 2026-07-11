<script lang="ts">
	import { onMount } from 'svelte';
	import { Inbox } from 'lucide-svelte';
	import { api } from '$lib/api/client';
	import { API } from '$lib/constants';
	import RequestCard from '$lib/components/RequestCard.svelte';
	import WantedWatchCard from '$lib/components/WantedWatchCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { authStore } from '$lib/stores/authStore.svelte';
	import {
		fetchActiveRequests,
		fetchRequestHistory,
		fetchPendingApprovals,
		cancelRequest,
		retryRequest,
		clearHistoryItem,
		approveRequest,
		rejectRequest
	} from '$lib/utils/requestsApi';
	import type { ActiveRequestItem, RequestHistoryItem } from '$lib/types';
	import type { WantedWatchItem } from '$lib/queries/wanted/types';

	type Tab = 'active' | 'history' | 'wanted' | 'approvals';
	let tab = $state<Tab>('active');

	let active = $state<ActiveRequestItem[]>([]);
	let history = $state<RequestHistoryItem[]>([]);
	let wanted = $state<WantedWatchItem[]>([]);
	let approvals = $state<ActiveRequestItem[]>([]);
	let loading = $state(false);

	const isAdmin = $derived(authStore.isAdmin);
	const tabs = $derived<Tab[]>(
		isAdmin ? ['active', 'history', 'wanted', 'approvals'] : ['active', 'history', 'wanted']
	);

	async function loadTab(t: Tab) {
		loading = true;
		try {
			if (t === 'active') active = (await fetchActiveRequests()).items;
			else if (t === 'history') history = (await fetchRequestHistory(1, 20)).items;
			else if (t === 'wanted')
				wanted = (await api.global.get<{ items: WantedWatchItem[] }>(API.requests.wanted())).items;
			else if (t === 'approvals') approvals = (await fetchPendingApprovals()).items;
		} catch {
			/* leave prior data */
		}
		loading = false;
	}

	function select(t: Tab) {
		tab = t;
		void loadTab(t);
	}

	onMount(() => void loadTab('active'));
</script>

<div class="mx-auto w-full max-w-4xl px-4 py-8">
	<div class="mb-6 flex items-center gap-2">
		<Inbox class="h-6 w-6 text-primary" aria-hidden="true" />
		<h1 class="text-2xl font-bold">Requests</h1>
	</div>

	<div role="tablist" class="tabs-border tabs mb-4">
		{#each tabs as t (t)}
			<button role="tab" class="tab {tab === t ? 'tab-active' : ''}" onclick={() => select(t)}>
				{t === 'active'
					? 'Active'
					: t === 'history'
						? 'History'
						: t === 'wanted'
							? 'Wanted'
							: 'Approvals'}
			</button>
		{/each}
	</div>

	{#if loading}
		<span class="loading loading-dots loading-lg"></span>
	{:else if tab === 'active'}
		{#if active.length === 0}
			<EmptyState icon={Inbox} title="No active requests" description="Requested albums show here while they process." />
		{:else}
			<div class="flex flex-col gap-3">
				{#each active as item (item.musicbrainz_id)}
					<RequestCard
						{item}
						mode="active"
						oncancel={async (mbid) => {
							await cancelRequest(mbid);
							await loadTab('active');
						}}
					/>
				{/each}
			</div>
		{/if}
	{:else if tab === 'history'}
		{#if history.length === 0}
			<EmptyState icon={Inbox} title="No history yet" description="Completed and failed requests are recorded here." />
		{:else}
			<div class="flex flex-col gap-3">
				{#each history as item (item.musicbrainz_id)}
					<RequestCard
						{item}
						mode="history"
						onretry={async (mbid) => {
							await retryRequest(mbid);
							await loadTab('history');
						}}
						onclear={async (mbid) => {
							await clearHistoryItem(mbid);
							await loadTab('history');
						}}
					/>
				{/each}
			</div>
		{/if}
	{:else if tab === 'wanted'}
		{#if wanted.length === 0}
			<EmptyState icon={Inbox} title="Nothing wanted" description="Albums the watcher keeps hunting appear here." />
		{:else}
			<div class="flex flex-col gap-3">
				{#each wanted as item (item.release_group_mbid)}
					<WantedWatchCard
						{item}
						onstop={async (i) => {
							await api.global.post(API.requests.wantedStop(i.release_group_mbid));
							await loadTab('wanted');
						}}
						onresume={async (i) => {
							await api.global.post(API.requests.wantedResume(i.release_group_mbid));
							await loadTab('wanted');
						}}
					/>
				{/each}
			</div>
		{/if}
	{:else if tab === 'approvals'}
		{#if approvals.length === 0}
			<EmptyState icon={Inbox} title="Nothing to approve" description="User requests awaiting your approval land here." />
		{:else}
			<div class="flex flex-col gap-3">
				{#each approvals as item (item.musicbrainz_id)}
					<div class="flex items-center gap-2">
						<div class="flex-1">
							<RequestCard {item} mode="active" />
						</div>
						<button
							class="btn btn-success btn-sm"
							onclick={async () => {
								await approveRequest(item.musicbrainz_id);
								await loadTab('approvals');
							}}>Approve</button
						>
						<button
							class="btn btn-ghost btn-sm"
							onclick={async () => {
								await rejectRequest(item.musicbrainz_id);
								await loadTab('approvals');
							}}>Reject</button
						>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
