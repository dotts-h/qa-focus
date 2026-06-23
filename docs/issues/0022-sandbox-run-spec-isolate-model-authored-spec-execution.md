---
id: 0022
title: Sandbox run_spec — isolate model-authored spec execution
status: closed
severity: high
group: 0019
depends_on: []
github: 41
forgejo:
links:
  adr: 0010
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

## Resolution
Chose **both** layers (ADR 0010): a static capability scan AND a scrubbed env — defense in depth,
portable (pure Node, no container/infra). `src/spec-guard.mts`: `scanSpecCapabilities` rejects
host-capability imports/escapes; `safeSpecEnv` strips host secrets from the execution env.

## Acceptance
- [x] `run_spec` executes authored specs under a constrained boundary: a static pre-exec capability
      check rejects disallowed Node imports/escapes (at `write_spec`/`write_pom` AND a re-scan of all
      `tests/authored/*.ts` at `run_spec`), and the spec runs under a **scrubbed env** (`safeSpecEnv`,
      no host secrets).
- [x] ADR 0010 captures the chosen isolation approach (scan + scrubbed env) and its trade-offs
      (static, not an OS sandbox — accepted residual; container = future hardening).
- [x] Deterministic tests: `tests/spec-guard.spec.ts` (14) — fs/net/child_process/eval/Function/
      require/process.binding/dynamic-import all blocked, clean spec + auth fixture allowed, secrets
      dropped from `safeSpecEnv`; `tests/codify-depth.spec.ts` (+2) — `write_spec` rejects a
      capability-violating spec (never writes it) and `run_spec` blocks a planted file before running.
      A real authored spec still passes under a fully scrubbed `env -i`. No model, no quota.
- [x] SECURITY.md RESIDUAL updated (now "HARDENED" with the accepted residual); `npm run lint` +
      `PW_CHANNEL=chromium npm test` green (177 passed).

## Notes
Seam: `src/codify-tools.mjs` (`run_spec`) + a new isolation wrapper; `src/standards.mjs` if a static
import check is part of the answer. Threat model: SECURITY.md "RESIDUAL — the codifier executes
model-authored code". This is the highest-severity remainder because it's the one place the
control-first leash currently hands the model full Node at execution time. Record the decision before
implementing (recording-decisions).
