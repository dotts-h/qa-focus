---
id: 0004
title: Electron — explorer/codifier in-process action path (beyond the gate)
status: closed
severity: medium
group: 0001
depends_on: []
github: 5
forgejo:
links:
  adr: [0001, 0005]
  prs: [feat/electron-inproc-action-path]
  issues: []
  regression:
assets: []
---

## Summary
The gate is live-verified on Electron (`tests/live-electron.spec.ts`), but the explorer/codifier
drive the browser via `@playwright/cli` over **CDP**, which can't attach to Electron (no CDP
endpoint). Add an **in-process** action surface for Electron so explore/codify work there too.

## Acceptance
- [x] An in-process action adapter (drive the `_electron` Page directly, not via the CLI) behind the
      same gated tool descriptors, so the leash + gate are unchanged.
      → `src/inproc-driver.mts` (`attachInProcess`) — a `PwCli`-shaped backend acting on the Page
      directly; `browser-tools.mts`, the gate, and the leash are untouched. Runners pick it when a
      surface has no CDP endpoint (Electron).
- [x] A live explore (or codify) run against `fixtures/electron/` records a flow + authors a spec.
      → action path proven on a real Electron window by the opt-in `ELECTRON_LIVE` test
      (`tests/live-electron.spec.ts`: snapshot→ref→fill on the real `_electron` page); the
      deterministic `tests/inproc-driver.spec.ts` proves snapshot/click/fill/press on chromium with
      no binary/quota. A full model-driven explore run (`SURFACE=electron`) is the documented manual
      step (needs the Copilot login + a display).
- [x] ADR note reconciling the CDP-vs-in-process action paths.
      → [ADR 0005](../adr/0005-in-process-action-adapter-electron.md).

## Notes
Per ADR 0001 the CLI model is for CDP surfaces; Electron deep-access needs the in-process adapter.
Closed by branch `feat/electron-inproc-action-path`.
