---
id: 0002
title: OpenFin live-verify (RVM remote-debug + connectOverCDP)
status: open
severity: high
group: 0001
depends_on: []
github: 3
forgejo:
links:
  adr: 0003
  prs: []
  issues: [0003]
  regression:
assets: []
---

## Summary
Prove the gate/explorer/codifier on a real OpenFin app. `src/provider.mjs` already does
`connectOverCDP` + `contexts()[0].pages()` — research confirms that's the correct mechanism.

## Acceptance
- [ ] A test OpenFin `app.json` with `runtime.arguments: "--remote-debugging-port=<port>"`.
- [ ] RVM launched (free dev license) with remote debugging; provider attaches; a window is a Page.
- [ ] Gate grades a role+name locator inside an OpenFin window (mirrors live-electron).
- [ ] Multi-window selection helper (`contexts()/pages()` iteration) verified.

## Notes
**Infra-gated:** OpenFin runtime is **Windows/macOS only — no Linux** (verified). Run on the Mac mini
(`openfin-cli --launch --config app.json`) or a Proxmox Windows VM. Not reproducible on the Linux CI
VM — so the live test is opt-in (e.g. `OPENFIN_LIVE=1`), like the Electron one.
