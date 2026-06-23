---
id: 0026
title: Live autonomous explore to codify run on a real Electron window (in-process driver, xvfb)
status: closed
severity: medium
group: 0025
depends_on: []
github:
forgejo:
links:
  adr: 0005
  prs: []
  issues: [0004, 0027]
  regression: 5
assets: [0026-electron-explore-flow.json, 0026-codified-spec.ts]
---

> **Done 2026-06-23.** The live Electron explore→codify loop ran end-to-end — and caught + fixed a
> real production bug (REGRESSIONS #5). Codifier-output gap (web-shaped specs) split out as #0027.

## Outcome
- **Live explorer on Electron (in-process driver, no CDP, under `xvfb`).** A real Copilot model
  (claude-sonnet-4.6) drove `fixtures/electron/` via `attachInProcess`: it **snapshotted and acted by
  ref** (`fill e2 = "Buy groceries"`), with each assertion gate-graded at the `role` tier. Emitted a
  durable `explore-flow.json` (surface: electron) — saved as `assets/0026-electron-explore-flow.json`.
- **Real bug found + fixed (REGRESSIONS #5).** The first run failed: the in-process snapshot threw
  `ReferenceError: __name is not defined`. Root cause — the binaries run under the `tsx`/esbuild
  loader, which decorates the `page.evaluate` snapshot callback with esbuild's `__name(...)`
  keep-names helper; that helper isn't defined in the page's browser context. The unit tests missed
  it (Playwright's transform doesn't inject `__name`). Fix: `attachInProcess` installs a faithful
  `__name` shim via `addInitScript` + an immediate `evaluate`. New deterministic guard
  `tests/inproc-driver-tsx.spec.ts` runs the driver through the same `tsx` loader.
- **Codifier on the Electron flow.** Seeded with the flow, the codifier authored a gate-clean spec
  (3/3 locators accepted at `role`) that passed `run_spec` first try — saved as
  `assets/0026-codified-spec.ts`. **Caveat:** the authored spec is web-shaped (`{ page }` + `goto`),
  so `run_spec` executes it on web; the role+name locators were validated against the live Electron
  window during authoring, but making the *executed* spec launch Electron is follow-up **#0027**.

## Acceptance
- [x] A live `SURFACE=electron` explorer run on `fixtures/electron/` under `xvfb` emits a durable flow
      via the in-process driver (no CDP), gate-checked.
- [x] The codifier turns that flow into a gate-clean authored spec that passes `run_spec`. *(Spec is
      web-shaped — executing it on Electron is split out as #0027; locators were gate-validated against
      the live Electron window.)*
- [x] Evidence captured (`assets/0026-*`) + gotcha logged (REGRESSIONS #5, guard
      `tests/inproc-driver-tsx.spec.ts`); PLAN updated (Electron loop live-verified, not just the gate).


## Summary
Complete the live Electron verification deferred from #0004 / the M2 note. The in-process action
driver (`src/inproc-driver.mts`, ADR 0005) is the Electron answer to the CLI model: Electron exposes
no CDP endpoint, so the explorer/codifier act on the live Playwright `Page` directly through the same
`PwCli` shape the gate already calls. It is built, wired into `bin/explore.mts` and `bin/codify.mts`
(`SURFACE=electron` → `attachInProcess`), unit-tested (`tests/inproc-driver.spec.ts`, 10), and the
gate is live-verified on a real Electron window (`tests/live-electron.spec.ts`). **What remains** is a
real Copilot-model run of the *whole* loop on Electron — the Electron counterpart of #0024 (OpenFin)
and #0023 (live red-team).

## What "done" looks like
1. A real Copilot-model **explorer** drives `fixtures/electron/` autonomously via the in-process
   driver (`SURFACE=electron ELECTRON_ARGS=fixtures/electron`), under `xvfb` on the brain, emitting a
   durable `explore-flow.json` (accessible role+name steps, gate-checked asserts).
2. The **codifier** consumes that flow (`FLOW=…`) and authors a standards-clean spec that passes the
   real gate + `run_spec` — no human in the authoring loop.
3. Evidence captured (the flow artifact + the authored spec + run output); any gotchas logged to
   REGRESSIONS; PLAN's M2 Electron note + the "future work" line (PLAN:80) updated to live-verified.

## Acceptance
- [ ] A live `SURFACE=electron` explorer run on `fixtures/electron/` under `xvfb` emits a durable flow
      via the in-process driver (no CDP), gate-checked.
- [ ] The codifier turns that flow into a gate-clean authored spec that passes `run_spec` on the
      Electron-discovered flow.
- [ ] Evidence captured + gotchas logged; PLAN updated (Electron loop live-verified, not just the
      gate); if a deterministic guard is warranted by anything the live run surfaces, it is added.

## Notes
Seam: `src/inproc-driver.mts` + the `SURFACE=electron` branch of `bin/explore.mts`/`bin/codify.mts`.
No code blocker — gated on model quota only (available, per #0023/#0024). Pairs with #0004 (the closed
mechanism issue); this is its live counterpart. Launch the app **directory** (package.json `main`),
not a bare `main.js`, and pass `--no-sandbox` under `xvfb` (REGRESSIONS #1).
