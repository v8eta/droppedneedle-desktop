<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '$lib/api/client';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { profilesStore } from '$lib/desktop/profiles.svelte';
	import { disconnect, logout, logoutEverywhere } from '$lib/desktop/session';
	import { onMount } from 'svelte';

	interface SessionInfo {
		id: string;
		issued_at: string;
		last_seen_at: string | null;
		user_agent: string | null;
		current?: boolean;
	}

	let sessions = $state<SessionInfo[]>([]);
	let serverVersion = $state<string | null>(null);
	let loading = $state(true);
	let actionBusy = $state(false);
	let error = $state<string | null>(null);

	async function refresh() {
		loading = true;
		error = null;
		try {
			const resp = await api.global.get<{ sessions: SessionInfo[] }>('/api/v1/auth/sessions');
			sessions = resp.sessions;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load sessions.';
		}
		try {
			const v = await api.global.get<{ version?: string; current?: string }>('/api/v1/version');
			serverVersion = v.version ?? v.current ?? null;
		} catch {
			serverVersion = null;
		}
		loading = false;
	}

	async function revoke(id: string) {
		actionBusy = true;
		try {
			await api.global.delete(`/api/v1/auth/sessions/${id}`);
			await refresh();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to revoke session.';
		} finally {
			actionBusy = false;
		}
	}

	function fmt(iso: string | null): string {
		if (!iso) return '—';
		try {
			return new Date(iso).toLocaleString();
		} catch {
			return iso;
		}
	}

	onMount(() => void refresh());
</script>

<div class="min-h-screen bg-base-100 p-8">
	<div class="mx-auto flex max-w-3xl flex-col gap-6">
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-semibold">App settings</h1>
			<a class="btn btn-ghost btn-sm" href={resolve('/')}>← Back</a>
		</div>

		{#if error}
			<div class="alert alert-error text-sm">{error}</div>
		{/if}

		<div class="card bg-base-200">
			<div class="card-body gap-3">
				<h2 class="card-title text-base">Account</h2>
				{#if authStore.user}
					<p class="text-sm">
						{authStore.user.display_name}
						<span class="badge badge-outline badge-sm ml-1">{authStore.user.role}</span>
						{#if authStore.user.username}
							<span class="ml-2 opacity-60">@{authStore.user.username}</span>
						{/if}
					</p>
				{/if}
				<div class="flex flex-wrap gap-2">
					<button class="btn btn-sm" onclick={() => void logout()}>Sign out</button>
					<button class="btn btn-warning btn-sm" onclick={() => void logoutEverywhere()}>
						Sign out everywhere
					</button>
				</div>
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body gap-3">
				<h2 class="card-title text-base">Active sessions</h2>
				{#if loading}
					<span class="loading loading-dots loading-sm"></span>
				{:else if sessions.length === 0}
					<p class="text-sm opacity-60">No active sessions reported.</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr><th>Device</th><th>Signed in</th><th>Last seen</th><th></th></tr>
							</thead>
							<tbody>
								{#each sessions as s (s.id)}
									<tr>
										<td class="max-w-56 truncate text-xs" title={s.user_agent ?? ''}>
											{s.user_agent ?? 'unknown'}
											{#if s.current}<span class="badge badge-accent badge-xs ml-1">this app</span
												>{/if}
										</td>
										<td class="text-xs">{fmt(s.issued_at)}</td>
										<td class="text-xs">{fmt(s.last_seen_at)}</td>
										<td>
											<button
												class="btn btn-ghost btn-xs"
												disabled={actionBusy}
												onclick={() => void revoke(s.id)}
											>
												revoke
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body gap-3">
				<h2 class="card-title text-base">Server</h2>
				{#if profilesStore.active}
					<p class="text-sm">
						{profilesStore.active.name}
						<span class="ml-2 opacity-60">{profilesStore.active.baseUrl}</span>
						{#if serverVersion}
							<span class="badge badge-outline badge-sm ml-2">DN {serverVersion}</span>
						{/if}
					</p>
				{/if}
				<div>
					<button class="btn btn-error btn-sm" onclick={() => void disconnect()}>
						Disconnect from this server
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
