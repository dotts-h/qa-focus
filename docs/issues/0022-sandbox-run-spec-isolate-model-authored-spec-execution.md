---
id: 0022
title: Sandbox run_spec — isolate model-authored spec execution
status: open
severity: high
group: 0019
depends_on: []
github: 41
forgejo:
links:
  adr:
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
Close the SECURITY.md RESIDUAL: the codifier's `write_spec` writes a `.spec.ts` that `run_spec` then
executes via `playwright test` (full Node). The standards linter blocks flaky patterns, **not**
arbitrary `require`/fs/network in the authored spec. Harden the execution boundary so a
model-authored spec cannot reach the host filesystem/network/secrets beyond what a Playwright test
legitimately needs.

## Repro
1. The codifier authors a spec that includes `require('fs')` / `child_process` / a network call
   unrelated to the browser flow.
Expected: `run_spec` executes the spec in a constrained environment (no ambient host fs/network/secret
access), or the spec is statically rejected before execution.
Actual: `run_spec` runs the spec with full Node privileges; the only defense is "untrusted until
human-reviewed" + "run only in a dev/CI sandbox" (SECURITY.md RESIDUAL).

## Acceptance
- [ ] `run_spec` executes authored specs under a constrained boundary (e.g. dedicated sandbox /
      container / restricted env + scrubbed secrets), OR a static pre-exec check rejects specs that
      import disallowed Node capabilities — decided in a short ADR.
- [ ] A decision record (ADR) captures the chosen isolation approach and its trade-offs.
- [ ] Deterministic test: an authored spec attempting host fs/network access is contained/rejected;
      a legitimate browser-flow spec still runs green. No model, no quota.
- [ ] SECURITY.md RESIDUAL updated to reflect the new posture; `make lint` + `make test` green.

## Notes
Seam: `src/codify-tools.mjs` (`run_spec`) + a new isolation wrapper; `src/standards.mjs` if a static
import check is part of the answer. Threat model: SECURITY.md "RESIDUAL — the codifier executes
model-authored code". This is the highest-severity remainder because it's the one place the
control-first leash currently hands the model full Node at execution time. Record the decision before
implementing (recording-decisions).
