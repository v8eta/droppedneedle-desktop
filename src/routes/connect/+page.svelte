<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { normalizeBaseUrl, setConnection } from '$lib/desktop/connection';
	import { profilesStore } from '$lib/desktop/profiles.svelte';
	import { NetworkError, probeFetch } from '$lib/desktop/transport';
	import type { AuthProviders } from '$lib/queries/auth/types';

	let input = $state('');
	let name = $state('');
	let acceptInvalidCerts = $state(false);
	let showCertToggle = $state(false);
	let probing = $state(false);
	let error = $state<string | null>(null);
	let probed = $state<{ baseUrl: string; providers: AuthProviders | null } | null>(null);

	async function probe() {
		error = null;
		probed = null;
		probing = true;
		const baseUrl = normalizeBaseUrl(input);
		if (!baseUrl) {
			error = 'Enter a server address.';
			probing = false;
			return;
		}
		try {
			const health = await probeFetch(`${baseUrl}/health`, { acceptInvalidCerts });
			if (!health.ok) throw new NetworkError(`/health returned ${health.status}`);
			const body = (await health.json().catch(() => null)) as { status?: string } | null;
			if (body?.status !== 'ok') {
				error = "That server responded, but it doesn't look like DroppedNeedle.";
				return;
			}
			let providers: AuthProviders | null = null;
			try {
				const p = await probeFetch(`${baseUrl}/api/v1/auth/providers`, { acceptInvalidCerts });
				if (p.ok) providers = (await p.json()) as AuthProviders;
			} catch {
				// providers probe is best-effort; login page re-queries
			}
			probed = { baseUrl, providers };
		} catch (err) {
			if (err instanceof NetworkError && /certificate|tls|ssl/i.test(err.message)) {
				showCertToggle = true;
				error =
					'TLS certificate validation failed. If this server uses a self-signed certificate you trust, enable the option below and try again.';
			} else {
				error =
					err instanceof Error
						? `Couldn't reach the server: ${err.message}`
						: "Couldn't reach the server.";
			}
		} finally {
			probing = false;
		}
	}

	async function save() {
		if (!probed) return;
		const profileName = name.trim() || new URL(probed.baseUrl).host;
		await profilesStore.init();
		await profilesStore.add({
			name: profileName,
			baseUrl: probed.baseUrl,
			acceptInvalidCerts,
			lastUser: null,
			lastConnectedAt: null
		});
		await setConnection({ baseUrl: probed.baseUrl, token: null, acceptInvalidCerts });
		await goto(resolve('/login'));
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-base-100 p-6">
	<div class="card w-full max-w-lg bg-base-200 shadow-xl">
		<div class="card-body gap-4">
			<h1 class="card-title text-2xl">Connect to DroppedNeedle</h1>
			<p class="text-sm opacity-70">
				Enter your server's address — a domain (https://dn.example.com) or a LAN address
				(http://192.168.1.10:8688).
			</p>

			<form
				class="flex flex-col gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					void probe();
				}}
			>
				<label class="form-control">
					<span class="label-text mb-1">Server address</span>
					<input
						type="text"
						class="input input-bordered w-full"
						placeholder="dn.example.com"
						bind:value={input}
						autocomplete="off"
						spellcheck="false"
					/>
				</label>

				{#if showCertToggle}
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							class="checkbox checkbox-warning"
							bind:checked={acceptInvalidCerts}
						/>
						<span class="label-text">Trust this server's self-signed certificate</span>
					</label>
				{/if}

				<button class="btn btn-primary" type="submit" disabled={probing}>
					{#if probing}<span class="loading loading-spinner loading-sm"></span>{/if}
					Test connection
				</button>
			</form>

			{#if error}
				<div class="alert alert-error text-sm">{error}</div>
			{/if}

			{#if probed}
				<div class="alert alert-success text-sm">
					DroppedNeedle server found at {probed.baseUrl}
					{#if probed.providers}
						— sign-in methods: {[
							probed.providers.local && 'local',
							probed.providers.plex && 'Plex',
							probed.providers.jellyfin && 'Jellyfin',
							probed.providers.oidc && 'OIDC'
						]
							.filter(Boolean)
							.join(', ')}
					{/if}
				</div>
				<label class="form-control">
					<span class="label-text mb-1">Profile name (optional)</span>
					<input
						type="text"
						class="input input-bordered w-full"
						placeholder={new URL(probed.baseUrl).host}
						bind:value={name}
					/>
				</label>
				<button class="btn btn-accent" onclick={() => void save()}>Continue to sign in</button>
			{/if}
		</div>
	</div>
</div>
