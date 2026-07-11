<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Disc3, Download, Heart, Inbox, Library, Search, Settings } from 'lucide-svelte';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { downloadsActivity } from '$lib/stores/downloadsActivity.svelte';
	import NewReleasesNavBadge from '$lib/components/NewReleasesNavBadge.svelte';

	let query = $state('');

	const links = [
		{ href: '/search', label: 'Search', icon: Search },
		{ href: '/downloads', label: 'Downloads', icon: Download },
		{ href: '/requests', label: 'Requests', icon: Inbox },
		{ href: '/following', label: 'Following', icon: Heart },
		{ href: '/library', label: 'Library', icon: Library }
	] as const;

	function submitSearch(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (q) void goto(`${resolve('/search')}?q=${encodeURIComponent(q)}`);
	}
</script>

<header class="navbar min-h-12 gap-2 border-b border-base-300 bg-base-200 px-4">
	<nav class="flex items-center gap-1">
		<a
			class="btn btn-ghost btn-sm btn-square {page.url.pathname === '/' ? 'btn-active' : ''}"
			href={resolve('/')}
			aria-label="Home"
		>
			<Disc3 class="h-4 w-4 text-primary" />
		</a>
		{#each links as l (l.href)}
			<a
				class="btn btn-ghost btn-sm {page.url.pathname === l.href ? 'btn-active' : ''}"
				href={resolve(l.href)}
			>
				<l.icon class="h-4 w-4" />
				{l.label}
				{#if l.href === '/downloads' && downloadsActivity.count > 0}
					<span class="badge badge-primary badge-sm">{downloadsActivity.count}</span>
				{/if}
				{#if l.href === '/following'}
					<NewReleasesNavBadge />
				{/if}
			</a>
		{/each}
	</nav>

	<form class="mx-2 flex-1" onsubmit={submitSearch}>
		<input
			type="search"
			class="input input-sm input-bordered w-full max-w-md"
			placeholder="Search artists or albums…"
			bind:value={query}
		/>
	</form>

	<div class="flex items-center gap-2">
		{#if authStore.user}
			<span class="text-xs opacity-70">{authStore.user.display_name}</span>
			<span class="badge badge-outline badge-xs">{authStore.user.role}</span>
		{/if}
		<a class="btn btn-ghost btn-sm btn-square" href={resolve('/settings')} aria-label="Settings">
			<Settings class="h-4 w-4" />
		</a>
	</div>
</header>
