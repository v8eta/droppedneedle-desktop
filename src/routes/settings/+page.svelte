<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '$lib/api/client';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { profilesStore } from '$lib/desktop/profiles.svelte';
	import { disconnect, logout, logoutEverywhere } from '$lib/desktop/session';
	import { isAutostartEnabled, setAutostart } from '$lib/desktop/autostart';
	import {
		loadNotificationPrefs,
		setNotificationPrefs,
		type NotificationPrefs
	} from '$lib/desktop/notifications';
	import { THEMES, getTheme, setTheme } from '$lib/desktop/theme';
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

	// Desktop preferences
	let autostart = $state(false);
	let notifPrefs = $state<NotificationPrefs>(loadNotificationPrefs());
	let theme = $state(getTheme());

	function onThemeChange(next: string) {
		theme = next;
		setTheme(next); // applies instantly + persists
	}

	async function toggleAutostart() {
		const next = !autostart;
		try {
			await setAutostart(next);
			autostart = next;
		} catch {
			/* leave as-is */
		}
	}

	function toggleNotif(key: keyof NotificationPrefs) {
		notifPrefs = { ...notifPrefs, [key]: !notifPrefs[key] };
		setNotificationPrefs(notifPrefs);
	}

	onMount(() => {
		void refresh();
		void isAutostartEnabled().then((v) => (autostart = v));
	});
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
				<h2 class="card-title text-base">Desktop</h2>
				<label class="label justify-between">
					<span class="label-text">Theme</span>
					<select
						class="select select-bordered select-sm w-48"
						value={theme}
						onchange={(e) => onThemeChange((e.currentTarget as HTMLSelectElement).value)}
					>
						{#each THEMES as t (t.name)}
							<option value={t.name}>{t.label}</option>
						{/each}
					</select>
				</label>
				<label class="label cursor-pointer justify-between">
					<span class="label-text">Start with Windows</span>
					<input
						type="checkbox"
						class="toggle toggle-sm"
						checked={autostart}
						onchange={() => void toggleAutostart()}
					/>
				</label>
				<div class="divider my-0 text-xs opacity-50">Notifications</div>
				{#each [['downloads', 'Downloads finished / failed'], ['held', 'Tracks needing review'], ['releases', 'New releases & auto-downloads']] as [key, label] (key)}
					<label class="label cursor-pointer justify-between">
						<span class="label-text">{label}</span>
						<input
							type="checkbox"
							class="toggle toggle-sm"
							checked={notifPrefs[key as keyof NotificationPrefs]}
							onchange={() => toggleNotif(key as keyof NotificationPrefs)}
						/>
					</label>
				{/each}
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
