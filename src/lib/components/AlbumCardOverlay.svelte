<script lang="ts">
	// DESKTOP: full replacement of upstream AlbumCardOverlay. Upstream renders
	// play/shuffle/queue/playlist hover actions wired to the player and playlist
	// modal — all consumption features outside this client's scope. The desktop
	// management client keeps the same props interface (AlbumCard renders us
	// unconditionally) but overlays nothing; requesting happens through
	// AlbumCard's own request affordance and the album detail page.
	interface Props {
		mbid: string;
		albumName: string;
		artistName: string;
		coverUrl: string | null;
		artistId?: string;
		size?: 'sm' | 'md';
	}

	// Props accepted for interface compatibility; intentionally unused.
	let {}: Props = $props();
</script>
