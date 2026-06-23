---
id: 0019
title: Epic: v1.1 — close the deferred remainders
status: open
severity: medium
group: 
depends_on: []
github: 38
forgejo:
links:
  adr:
  prs: []
  issues: []
  regression:
assets: []
---

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
- [ ] #0020 lands (trace→DOM extraction wired into the healer, gate-verified, tested).
- [ ] #0021 lands (nested iframe + frameset coverage in the gate, tested).
- [ ] #0022 lands (`run_spec` execution isolated; SECURITY RESIDUAL updated).
- [ ] #0023 and #0024 are tracked with their gate (quota / infra) documented; they land when the
      prerequisite (credits / hardware) is available, or are explicitly deferred to a later milestone.

## Notes
This is a *completion* epic, not a new pillar — it closes the gap between "documented as future work"
and "filed as trackable work". The buildable-now set (#0020–#0022) has disjoint seams (healer /
gate / codifier exec) and is parallelizable. #0023 (quota) and #0024 (infra) are deliberate decision
points — see PLAN.md "Decision points ahead".
