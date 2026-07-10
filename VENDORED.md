# Vendored code provenance

This app vendors part of the upstream DroppedNeedle web frontend's library
layer. Both projects are AGPL-3.0; see [LICENSE](LICENSE).

- **Upstream:** https://github.com/HabiRabbu/DroppedNeedle
- **Pinned commit:** `e6ea676b5a26a2c93c6adf6d96cf84f95f7be680` (2026-07-09)
- **Upstream path prefix:** `frontend/src/` → local `src/`

Vendored files keep their upstream-relative paths under `src/lib/` (plus
`src/app.css` and `static/fonts/*`), so a plain
`diff -r <upstream>/frontend/src/lib src/lib` shows exactly what diverges.
Files are **byte-identical to upstream at the pinned commit** unless listed
under _Modified files_ below; every intentional edit is marked in-code with a
`// DESKTOP:` comment. All desktop-only code lives in `src/lib/desktop/` and
`src/routes/`, which the sync tooling never touches.

Re-sync with `node scripts/sync-upstream.mjs <path-to-upstream-checkout>`
(see `scripts/vendored-manifest.json` for the file list).

## Modified files

| File                                    | Modification                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/api/client.ts`                 | 401 handler → `notifySessionExpired()` instead of `window.location.href`; dropped `credentials: 'include'` (bearer-only); `globalClient` fetch → `desktopFetch` |
| `src/lib/api/client.spec.ts`            | 401 test asserts the session-expired notification instead of store-clear + redirect                                                                             |
| `src/lib/api/api-utils.ts`              | `getApiUrl` resolves against the runtime server profile instead of `PUBLIC_API_URL` (rewritten)                                                                 |
| `src/lib/utils/navigationAbort.ts`      | inner `fetch` → `desktopFetch`                                                                                                                                  |
| `src/lib/utils/navigationAbort.test.ts` | signal assertions functional instead of identity (transport composes signals); headers read via `Headers.get`                                                   |
| `src/lib/queries/downloads/DownloadSSE.svelte.ts` | `new EventSource` → `createEventSource` (bearer-authenticated SSE over the Rust transport) |
| `src/lib/components/downloads/HeldTrackReview.svelte` | audio preview src wrapped in `mediaUrl()` (dn:// authenticated proxy) |
| `src/lib/components/AlbumCardOverlay.svelte` | full replacement: props-compatible empty overlay (upstream's play/queue/playlist hover actions are player features out of scope) |
| `src/routes/downloads/+page.svelte` | `DiscoveryBatchList` section trimmed (discover out of scope) |

## Unmodified files

Everything else listed in `scripts/vendored-manifest.json` (the authoritative
ledger — ~140 files as of M2: the full downloads query+component set, search
routes/cards, and their store/util dependency closure), plus
`static/fonts/*.woff2`.

The vendored set grows per milestone (following/library queries and
components arrive with their screens); update the manifest and this file in
the same PR that vendors new files.
