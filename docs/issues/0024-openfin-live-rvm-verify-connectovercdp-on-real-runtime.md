---
id: 0024
title: OpenFin live RVM verify (connectOverCDP on real runtime)
status: closed
severity: medium
group: 0019
depends_on: []
github: 43
forgejo:
links:
  adr: 0003
  prs: []
  issues: [0002]
  regression: 4
assets: []
---

## Summary
Complete the live OpenFin verification deferred from #0002. The `connectOverCDP` mechanism is wired
(`src/provider.mjs`) and verified against chromium-over-CDP; what remained was a **live run against a
real OpenFin RVM**. **Done 2026-06-24** on the M4 Mac mini (runtime 44.146.101.4) — and the live run
caught a real selection bug.

> **License correction.** The charter said "free OpenFin developer license" — there is **no license
> key to obtain for local dev**. OpenFin (now "Here"/io.Connect) provides a free Community/Developer
> license; the manifest `licenseKey` + commercial licensing are *production* concerns. Running our own
> `app.json` locally needs only the free `openfin-cli` (public npm). The real prerequisites are the
> macOS/Windows host (no Linux runtime) + Apple-Silicon needs Rosetta 2 (the RVM binary is x86_64).

## What was done
- `app.json` (`--remote-debugging-port=9222`) + fixture page launched on the Mac mini via
  `sudo launchctl asuser 501 sudo -u horiaradulescu openfin -l -c app.json` (GUI/Aqua session required;
  Rosetta 2 installed for the x86_64 RVM). CDP reached from the brain over an SSH tunnel.
- `OPENFIN_LIVE=1 OPENFIN_CDP=… npx playwright test live-openfin` → **3/3 green** on the real RVM:
  provider attaches over CDP, the gate grades `heading "Todo"` inside an OpenFin window, raw CSS
  bounces to the accessible tier, multi-window enumeration works.
- **Bug found + fixed:** the default window selection drove OpenFin's `openfin-internal://blank`
  provider window (listed first), not the app — the gate found nothing. Added
  `firstAppWindow`/`isInternalWindow` to skip internal windows by default (REGRESSIONS #4), with a
  deterministic guard in `tests/openfin-cdp.spec.ts`.

## Acceptance
- [x] A test `app.json` + setup notes for enabling remote debugging on the RVM (fixture README — incl.
      the Rosetta 2 + GUI-session gotchas).
- [x] A live `OPENFIN_LIVE=1` run against a real RVM: gate grades a target, multi-window selection
      works, evidence captured (runtime 44.146.101.4; the two windows enumerated).
- [x] Gotchas logged (REGRESSIONS #4 + fixture README); the OpenFin acceptance axis of epic #0001
      noted live-verified in PLAN (#0002 → DONE).

## Notes
Seam: `src/provider.mjs` (`openSurface({kind:'openfin'})` + window selection). Blocked purely on
hardware/license — no code blocker. Decision point: Mac mini vs Proxmox Windows VM (PLAN). Pairs
with #0002 (the closed mechanism issue); this is its live counterpart.
