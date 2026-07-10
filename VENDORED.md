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
under *Modified files* below; every intentional edit is marked in-code with a
`// DESKTOP:` comment. All desktop-only code lives in `src/lib/desktop/` and
`src/routes/`, which the sync tooling never touches.

Re-sync with `node scripts/sync-upstream.mjs <path-to-upstream-checkout>`
(see `scripts/vendored-manifest.json` for the file list).

## Modified files

| File | Modification |
| --- | --- |
| `src/lib/api/client.ts` | 401 handler → `notifySessionExpired()` instead of `window.location.href`; dropped `credentials: 'include'` (bearer-only); `globalClient` fetch → `desktopFetch` |
| `src/lib/api/api-utils.ts` | `getApiUrl` resolves against the runtime server profile instead of `PUBLIC_API_URL` (rewritten) |
| `src/lib/utils/navigationAbort.ts` | inner `fetch` → `desktopFetch` |

## Unmodified files

Everything else listed in `scripts/vendored-manifest.json`, currently:
`types.ts`, `constants.ts`, `colors.ts`, `api/client.spec.ts`,
`queries/{QueryClient.ts, QueryProvider.svelte, IndexedDbPersister.svelte.ts, VersionQuery*.ts}`,
`queries/auth/**`, `queries/system/**`,
`stores/{authStore.svelte, errorModal, musicSource(+spec), serviceStatus(+spec), toast, version.svelte}.ts`,
`utils/{abortController, dismissedPrompts, errorHandling(+spec), formatting(+spec), localStorageCache, navigationAbort.test, userScopedCaches}.ts`,
`src/app.css`, `static/fonts/*.woff2`.

The vendored set grows per milestone (downloads/following/library queries and
components arrive with their screens); update the manifest and this file in
the same PR that vendors new files.
