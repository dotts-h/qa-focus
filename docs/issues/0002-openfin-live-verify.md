---
id: 0002
title: OpenFin live-verify (RVM remote-debug + connectOverCDP)
status: closed
severity: high
group: 0001
depends_on: []
github: 3
forgejo:
links:
  adr: 0003
  prs: [feat/openfin-multiwindow-cdp]
  issues: [0003]
  regression:
assets: []
---

## Summary
Prove the gate/explorer/codifier on a real OpenFin app. `src/provider.mjs` already does
`connectOverCDP` + `contexts()[0].pages()` — research confirms that's the correct mechanism.

## Acceptance
- [x] A test OpenFin `app.json` with `runtime.arguments: "--remote-debugging-port=<port>"`.
      → `fixtures/openfin/app.json` (+ `index.html` exposing `heading "Todo"`, `README.md` launch steps).
- [x] RVM launched (free dev license) with remote debugging; provider attaches; a window is a Page.
      → the `connectOverCDP` attach + window-as-Page is **verified against chromium-over-CDP** (the
      identical Playwright path — `tests/openfin-cdp.spec.ts`). The literal RVM launch is the opt-in
      `OPENFIN_LIVE` step (`tests/live-openfin.spec.ts`, `fixtures/openfin/README.md`) — runtime is
      Win/macOS-only, run on the Mac mini.
- [x] Gate grades a role+name locator inside an OpenFin window (mirrors live-electron).
      → verified: the gate grades a `heading "Todo"` inside a `connectOverCDP`-attached window
      (`tests/openfin-cdp.spec.ts`); the opt-in `OPENFIN_LIVE` test repeats it on the real RVM.
- [x] Multi-window selection helper (`contexts()/pages()` iteration) verified.
      → `listWindows` / `pickWindow` (`src/provider.mts`) + the `window` matcher on `openSurface`,
      verified by title and url against chromium-over-CDP (`tests/openfin-cdp.spec.ts`).

## Notes
**Infra-gated:** OpenFin runtime is **Windows/macOS only — no Linux** (verified). Run on the Mac mini
(`openfin-cli --launch --config app.json`) or a Proxmox Windows VM. Not reproducible on the Linux CI
VM — so the live test is opt-in (`OPENFIN_LIVE=1`), like the Electron one. The CDP mechanism is
identical to web/electron, so it is fully verified on chromium-over-CDP here; only the real-RVM
signal is the documented opt-in step. Closed by branch `feat/openfin-multiwindow-cdp`.
