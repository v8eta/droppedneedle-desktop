# Manual verification checklists

Run per milestone against real servers. Targets:

- **prod** `https://droppedneedle.touki.me` — user `desktop-test` (role `user`) for
  routine checks; `touki` (admin) for admin-view reads only. Prod mutations are
  limited to the single M2 sign-off request.
- **sandbox** `http://10.12.12.6:8689` — `dev-admin`. ALL mutation testing
  (requests, imports, discards, settings writes) happens here.

## M1 — connect / auth / session

- [ ] Fresh install → first-run shows Connect screen.
- [ ] Enter `droppedneedle.touki.me` (no scheme) → normalized to https, probe
      succeeds, providers listed → login screen.
- [ ] Login as `desktop-test` → home shows display name + `user` role badge.
- [ ] Quit and relaunch → session restored, no login prompt (token from
      Windows Credential Manager).
- [ ] Token-expiry: in the web UI as `desktop-test`, revoke sessions
      (logout-all) → next app action returns to login cleanly, server URL
      preserved, no crash, no SSE reconnect storm (watch sandbox logs).
- [ ] Wrong password → friendly error. 6 rapid attempts → 429 handled with
      countdown on the button (login burst = 5).
- [ ] Connect to sandbox `http://10.12.12.6:8689` → login works (plain http +
      explicit port).
- [ ] `desktop-test` sees no admin-only nav (once shell lands).
- [ ] SSE badge on home reaches "open" and survives ≥10 min idle
      (keepalives, no reconnect churn in logs).
- [ ] dn:// media spike: avatar image loads (or dims gracefully on 404) —
      no CSP errors in webview devtools.

## M2 — request → queue → held review

- [ ] Sandbox: search an album → buckets render with covers → request →
      appears in queue.
- [ ] Queue item traverses cueing → downloading (live % via SSE) → history.
- [ ] Kill network mid-download (disable adapter) → app shows reconnecting,
      recovers state when network returns.
- [ ] Held round-trip on sandbox: held item appears → audio preview plays
      in-app (seek works) → Import lands it in the library; Discard removes a
      second one. Verify server-side in both cases.
- [ ] Cancel / retry / retry-all-failed buttons round-trip.
- [ ] Prod sign-off: as `touki`, request ONE genuinely-wanted album →
      completes end-to-end through real slskd/SAB → lands in the real library.
- [ ] Authz: `desktop-test` cannot see others' held items or any settings.
- [ ] Rate-limit and error envelopes render as toasts, not blank screens.

## M3 — following / library / native

- [ ] Follow an artist on sandbox; trigger a following event → Windows toast
      fires while app is tray-minimized; clicking focuses the right screen.
- [ ] Tray tooltip and taskbar badge match active queue count (cross-check
      GET /downloads).
- [ ] Batch-request 5 albums → notifications grouped/debounced, no storm.
- [ ] New held item raises the "needs your ear" toast.
- [ ] Close-to-tray → restore → quit-from-tray lifecycle clean; autostart
      toggle survives sign-out/sign-in.
- [ ] App restart does not replay old toasts (persisted de-dupe).
- [ ] Overnight soak against prod (desktop-test): SSE alive or cleanly
      reconnected next morning; memory roughly flat in Task Manager.
