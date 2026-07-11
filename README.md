# DroppedNeedle Desktop

Unofficial Windows desktop **management client** for
[DroppedNeedle](https://github.com/HabiRabbu/DroppedNeedle) — a native workbench
for requesting music, watching downloads land, and keeping your library close.
Built with Tauri 2 + Svelte 5.

> Not affiliated with the DroppedNeedle project. This is a third-party client
> that talks to DroppedNeedle's REST API.

This is deliberately **not** a music player. DroppedNeedle already speaks
OpenSubsonic and Jellyfin, so players like Feishin, Supersonic and Symfonium
cover playback beautifully. This app is the management surface — the parts a
browser tab does clumsily — made native.

## Features

- **Search & request** — find artists and albums, request with one click, watch
  the request move through the pipeline.
- **Live download queue** — the full engine-room view: active transfers with
  live progress, retry ladders, "needs you" candidate picks, and (admins)
  quarantine — updated over SSE.
- **Held-import review** — audition AcoustID mismatches with an in-app audio
  player and import-anyway / discard, the one queue that blocks on a human.
- **Following** — followed-artist grid, new-release feed, follow &
  auto-download toggles.
- **Library** — browse your native library with stats, sort and filter; full
  artist (discography) and album (tracklist + activity) detail pages.
- **Requests** — active / history / wanted watches, plus admin approvals.
- **Native desktop** — system tray with a live download badge, close-to-tray,
  launch-at-startup, and **Windows notifications** for downloads finishing,
  failing, or a track needing your review — alerts the web UI can't give you.

## Install

Download the latest `*_x64-setup.exe` from
[Releases](https://github.com/v8eta/droppedneedle-desktop/releases) and run it.

The installer is unsigned, so Windows SmartScreen will show *"Windows protected
your PC"* on first run — click **More info → Run anyway**. (A signed build may
come later; the app is open-source and you can build it yourself below.)

The app self-updates from GitHub Releases once installed.

## Connecting to your server

The app authenticates with your normal DroppedNeedle account (it stores the
bearer token in Windows Credential Manager). On first launch, point it at your
server — it works with either:

- a direct LAN/VPN address — `http://192.168.1.10:8688`
- a reverse-proxied domain — `https://dn.example.com`

If your reverse proxy puts SSO / forward-auth (Authelia, Authentik, …) in front
of DroppedNeedle, **exempt `/api` and `/health` from it** for this app to
connect — DroppedNeedle enforces its own authentication on every API route
(this is the same pattern used to reach Sonarr/Radarr's API behind SSO).
OIDC-only servers: sign in with a local, Plex, or Jellyfin account — OIDC
browser redirects can't complete inside a desktop app.

Self-signed certificate on a LAN server? The connect screen offers a per-server
"trust this certificate" toggle after a TLS failure.

## Development

The UI runs in a plain browser against any DroppedNeedle server via the Vite
proxy; native behavior (tray, notifications, updater) needs a Windows build.

```sh
pnpm install
DN_DEV_TARGET=http://your-dn-server:8688 pnpm dev   # browser UI dev (Vite proxy)
pnpm tauri dev                                       # full app (needs Rust + WebView2)
pnpm tauri build                                     # NSIS installer
# Linux → Windows cross-compile: pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

## License & provenance

AGPL-3.0-only. This client vendors part of the upstream DroppedNeedle frontend's
library layer (types, API client, query modules, components) — see
[VENDORED.md](VENDORED.md) for the pinned commit and the exact list of
modifications.
