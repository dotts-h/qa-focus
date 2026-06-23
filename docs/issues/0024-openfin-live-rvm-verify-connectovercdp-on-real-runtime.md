---
id: 0024
title: OpenFin live RVM verify (connectOverCDP on real runtime)
status: open
severity: medium
group: 0019
depends_on: []
github: 43
forgejo:
links:
  adr: 0003
  prs: []
  issues: [0002]
  regression:
assets: []
---

## Summary
Complete the live OpenFin verification deferred from #0002. The `connectOverCDP` mechanism is wired
(`src/provider.mjs`) and verified against chromium-over-CDP; what remains is a **live run against a
real OpenFin RVM** started with remote debugging, with the multi-window selection helper exercised
on actual OpenFin Pages.

> **BLOCKED ON INFRA.** OpenFin has no Linux runtime — this needs a macOS RVM (Mac mini) or a
> Proxmox Windows VM, a free OpenFin developer license, and a test `app.json` with
> `runtime.arguments: "--remote-debugging-port=…"`. Cannot be built on the Linux brain. Stays open
> as a tracked decision point until the host is available (PLAN "Decision points ahead").

## Repro
1. On macOS/Windows, launch an OpenFin app via an `app.json` whose manifest enables remote debugging.
2. `connectOverCDP` to the RVM; enumerate windows as Pages; run the gate + a smoke explore flow.
Expected: the gate grades a role+name target inside an OpenFin window identically to web/Electron;
the multi-window selection helper picks the intended window.
Actual: only the CDP mechanism (against chromium) is verified; no run against a real RVM exists.

## Acceptance
- [ ] A test `app.json` + setup notes for enabling remote debugging on the RVM (documented in repo).
- [ ] A live `OPENFIN_LIVE=1` run against a real RVM: gate grades a target, multi-window selection
      works, evidence captured.
- [ ] Result + any gotchas logged (logging-learnings / REGRESSIONS); the OpenFin acceptance axis of
      epic #0001 noted as live-verified.

## Notes
Seam: `src/provider.mjs` (`openSurface({kind:'openfin'})` + window selection). Blocked purely on
hardware/license — no code blocker. Decision point: Mac mini vs Proxmox Windows VM (PLAN). Pairs
with #0002 (the closed mechanism issue); this is its live counterpart.
