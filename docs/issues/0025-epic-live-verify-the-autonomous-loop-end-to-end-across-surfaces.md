---
id: 0025
title: Epic: live-verify the autonomous loop end-to-end across surfaces
status: closed
severity: medium
group: 
depends_on: []
github:
forgejo:
links:
  adr: [0005, 0011]
  prs: []
  issues: []
  regression: 5
assets: []
---

> **Epic complete 2026-06-23.** Both children landed: #0026 (live Electron explore→codify loop +
> fixed the in-process driver `__name` crash, REGRESSIONS #5) and #0027 (surface-aware authored specs
> — `SURFACE=electron` authors an `_electron.launch` spec that runs on the real Electron app, ADR
> 0011). The autonomous loop is now live-verified end-to-end on Electron, and the live runs caught +
> fixed two real gaps (the `__name` snapshot crash; codify not passing `electronArgs`). The roadmap
> is exhausted again — next is a product call on a new pillar (PLAN "When the pick is ambiguous").

## Summary
v1 (#0001), the multi-host runner (#0015), and the v1.1 remainders (#0019) are all closed. A
research pass at session start (2026-06-23) found the filed roadmap exhausted, but two **live-verification
completion** gaps still stand in the docs — claims the code makes that are unit-tested and
gate-verified live, but where the *full autonomous model-driven loop* has never been observed
end-to-end:

- **Electron** (PLAN:80 "a CLI-free in-process action path for Electron is future work"; M2 note
  "only the in-process gate is verified here"). The in-process driver (`src/inproc-driver.mts`) is
  built, wired into both `bin/explore.mts` and `bin/codify.mts`, unit-tested
  (`tests/inproc-driver.spec.ts`), and the gate is live-verified on a real Electron window
  (`tests/live-electron.spec.ts`). What is missing is a real Copilot-model **explore→codify** run on
  Electron — the Electron counterpart of what #0024 did for OpenFin.
- **Extension/TUI** (PLAN:99, M3 "Remaining"): observe a model completing a *full flow* purely
  through the registered extension tools in a real interactive TUI session (prompt-mode distorted
  model behavior; the tools/gate/codify→run are independently verified).

This epic closes the gap between "coded + unit-tested" and "observed live end-to-end" for the
cross-surface autonomous loop. It is a **completion** epic, not a new pillar — like #0019. The
deliberately-scoped-out items (OS-level `run_spec` sandbox per ADR 0010; AST-aware scan) are NOT in
scope: they are standing decisions, to be reopened only if a triggering need appears.

## Children
- **#0026 — Live autonomous explore→codify on a real Electron window** *(buildable now; spends model
  credits; runs under `xvfb` on the brain)*. The Electron counterpart of #0024. Drive a real
  Copilot-model explorer through the in-process driver on `fixtures/electron/`, hand the emitted flow
  to the codifier, and confirm a gate-clean authored spec results — the whole loop, no human in the
  authoring loop, on Electron.

(Further children — e.g. the M3 extension-TUI full-flow observation — filed as the loop progresses.)

## Acceptance
- [ ] #0026 lands: a live Copilot-model explore→codify run on a real Electron window, gate-verified,
      with evidence captured and PLAN's Electron note updated to live-verified.
- [ ] Each documented "Remaining"/"future work" loop-verification gap is either closed by a child or
      explicitly re-classified (decision, not omission) in PLAN.

## Notes
Seams: `src/inproc-driver.mts` + `bin/explore.mts`/`bin/codify.mts` (Electron); the
`extension/qa-focus/` tools + `bin/interactive.mts` (TUI). No code blocker — these are live-run /
observation tasks gated on model quota, which #0023/#0024 showed is available. When the children are
done the roadmap is genuinely exhausted and the next move is a product call on a new pillar (e.g.
real-app dogfooding, a canvas/coordinate action tier) — not work this epic should invent.
