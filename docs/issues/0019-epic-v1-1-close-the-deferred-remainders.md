---
id: 0019
title: Epic: v1.1 — close the deferred remainders
status: closed
severity: medium
group: 
depends_on: []
github: 38
forgejo:
links:
  adr: [0009, 0010]
  prs: [45, 46, 47, 48, 49]
  issues: []
  regression: [4, R1]
assets: []
---

> **Epic complete 2026-06-24.** All five children landed: #0020 (PR #45), #0022 (PR #46),
> #0021 (PR #47), #0024 (PR #48), #0023 (PR #49). #0023/#0024 were unblocked mid-milestone
> (credits unlocked; OpenFin live-verified on the M4 Mac mini) rather than deferred. The live
> OpenFin run also caught + fixed a real window-selection bug (REGRESSIONS #4).

## Summary
v1 (epic #0001) and the multi-host runner (epic #0015) are closed, but a handful of items were
documented as **deferred / blocked / quota-gated** in `docs/PLAN.md`, the ADRs, and
`docs/SECURITY.md` rather than filed as open issues. This epic collects those remainders so the
roadmap reflects the true outstanding state, and drives the **buildable-now** ones to done.

## Children
- **#0020 — Trace-driven healer integration** *(buildable now, deterministic)*. The recover+re-grade
  core (`extractTraceContext` / `healFromTrace`) shipped under #0010; the one deferred "thin
  integration step" — pulling the DOM snapshot HTML out of `explore-trace.zip` and feeding it in — is
  still open.
- **#0021 — Nested/multi-level iframe + inline `<frameset>` gate coverage** *(buildable now)*. PLAN
  records the limit: "nested iframes are single-level today" and legacy `<frameset>` is not surfaced
  inline.
- **#0022 — Sandbox `run_spec`** *(buildable now, security)*. SECURITY.md RESIDUAL: the codifier runs
  model-authored spec code in full Node; "Future hardening: sandbox `run_spec`."
- **#0023 — Live model-driven red-team** *(gated on model quota)*. The deterministic injection layer
  is done; a live model-driven adversarial pass on a hostile fixture page remains. Spends credits.
- **#0024 — OpenFin live RVM verify** *(blocked on infra)*. The `connectOverCDP` mechanism is
  verified against chromium-over-CDP; a live RVM run needs macOS/Windows infra (no Linux runtime).

## Acceptance
- [x] #0020 lands (trace→DOM extraction wired into the healer via a purpose-built snapshot store, ADR 0009).
- [x] #0021 lands (nested-iframe `frameLocator` chaining + frameset coverage in the gate, tested).
- [x] #0022 lands (`run_spec` isolated — capability scan + scrubbed env, ADR 0010; SECURITY RESIDUAL → HARDENED).
- [x] #0023 and #0024 landed (not deferred): #0024 OpenFin **live-verified** on the Mac mini (+ bug fix);
      #0023 injection red-team **live-verified** with the real model — the leash held / actively denied.

## Notes
This is a *completion* epic, not a new pillar — it closes the gap between "documented as future work"
and "filed as trackable work". The buildable-now set (#0020–#0022) has disjoint seams (healer /
gate / codifier exec) and is parallelizable. #0023 (quota) and #0024 (infra) are deliberate decision
points — see PLAN.md "Decision points ahead".
