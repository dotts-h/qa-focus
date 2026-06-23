---
id: 0004
title: Electron — explorer/codifier in-process action path (beyond the gate)
status: open
severity: medium
group: 0001
depends_on: []
github: 5
forgejo:
links:
  adr: 0001
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
The gate is live-verified on Electron (`tests/live-electron.spec.ts`), but the explorer/codifier
drive the browser via `@playwright/cli` over **CDP**, which can't attach to Electron (no CDP
endpoint). Add an **in-process** action surface for Electron so explore/codify work there too.

## Acceptance
- [ ] An in-process action adapter (drive the `_electron` Page directly, not via the CLI) behind the
      same gated tool descriptors, so the leash + gate are unchanged.
- [ ] A live explore (or codify) run against `fixtures/electron/` records a flow + authors a spec.
- [ ] ADR note reconciling the CDP-vs-in-process action paths.

## Notes
Per ADR 0001 the CLI model is for CDP surfaces; Electron deep-access needs the in-process adapter.
