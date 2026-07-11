# DroppedNeedle Desktop

Unofficial Windows desktop **management client** for
[DroppedNeedle](https://github.com/HabiRabbu/DroppedNeedle) — request music,
watch the download queue live, review held imports with in-app audio preview,
follow artists, and browse your library. Built with Tauri 2 + Svelte 5.

> **Status: alpha.** Connect/sign-in, live download queue, held-import review,
> and music search/request all work. Following, library browse, and native
> tray/notifications are in progress. Not affiliated with the DroppedNeedle
> project.

This is deliberately _not_ a music player: DroppedNeedle already speaks
OpenSubsonic and Jellyfin, so players like Feishin, Supersonic and Symfonium
cover playback. This app is the workbench — the management surface, native.

## Connecting to your server

The app talks to DroppedNeedle's `/api/v1` REST API with your DN account
(bearer token from the normal login). It works with:

- a direct LAN/VPN address — `http://192.168.1.10:8688`
- a reverse-proxied domain — `https://dn.example.com`

If your reverse proxy puts SSO/forward-auth (Authelia, Authentik, …) in front
of DroppedNeedle, exempt `/api` and `/health` from it for this app to work —
DroppedNeedle enforces its own authentication on every API route (this is the
same pattern used for Sonarr/Radarr API access). OIDC-only servers: the app
signs in with local, Plex, or Jellyfin credentials; OIDC browser redirects
can't complete inside a desktop app.

## Development

Dev loop is split: UI work runs in a plain browser against any DN server via
the Vite proxy; native behavior needs a Windows build.

```sh
pnpm install
DN_DEV_TARGET=http://your-dn-server:8688 pnpm dev   # browser UI dev (Vite proxy)
pnpm tauri dev                                       # full app (needs Rust + WebView2)
pnpm tauri build                                     # NSIS installer
# Linux cross-compile: pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

## License & provenance

AGPL-3.0-only. This client vendors part of the upstream DroppedNeedle
frontend's library layer (types, API client, query modules) — see
[VENDORED.md](VENDORED.md) for the pinned commit and the exact modification
list.
