# ADR 0010 — Isolate model-authored spec execution with a capability scan + a scrubbed environment

- Status: accepted
- Date: 2026-06-23

## Context

The codifier turns a discovered flow into a Playwright test: `write_spec` writes
`tests/authored/<name>.spec.ts` and `run_spec` executes it via `npx playwright test` (full Node).
The standards linter (`src/standards.mts`) rejects *flaky* patterns (hard sleeps, `networkidle`, raw
handles, XPath) but **not** host-capability access. So a model-authored spec could
`import { readFileSync } from 'fs'`, `require('child_process')`, open a socket, or read the host
environment (secrets) and exfiltrate — and `run_spec` ran it with the **full `process.env`** inherited
(`env: { ...process.env, RUN_AUTHORED: '1' }`). SECURITY.md flagged this as a RESIDUAL: "the codifier
executes model-authored code … run only in a dev/CI sandbox." #0022 hardens that boundary.

The control-first leash cages the *model's tools* (it never gets raw shell/fs), but `run_spec` is the
one place the program itself hands model-*authored code* to a full Node runtime. We want a portable
hardening that runs anywhere the codifier runs (the brain VM, CI) with **no new infrastructure** —
not a container/VM the sandbox or CI may not be able to nest.

## Options

1. **OS-level sandbox (container / microVM).** True isolation, but needs Docker-in-Docker or a VM
   the run host may not provide; heavy; not portable to a plain `npm` checkout.
2. **Node permission model (`--experimental-permission --allow-fs-read=…`).** Playwright spawns its
   own worker processes; threading permission flags through the runner is fragile and version-bound.
3. **Static capability scan + scrubbed environment (defense in depth).** (a) Reject authored source
   that imports Node host-capability modules (`fs`, `child_process`, `net`, …) or uses
   `eval`/`Function`/`require`/`process.binding`, enforced at **write** time *and* re-scanned at
   **run** time. (b) Execute under a **minimal allowlisted env** so the spec process sees no host
   secrets even if the scan is bypassed.

## Decision

**Option 3.** Add `src/spec-guard.mts`:

- `scanSpecCapabilities(source)` — a deterministic, comment-aware scan that BLOCKS imports/requires of
  a dangerous-core-module set and the dynamic-escape constructs (`eval(`, `new Function(`, `require(`,
  `process.binding`, non-literal `import(`). `write_spec` / `write_pom` reject a violating source
  before writing; `run_spec` re-scans every `tests/authored/*.ts` before executing (defense in depth —
  catches anything not written through the tools).
- `safeSpecEnv(base)` — builds the child env from a small allowlist (PATH, HOME, the X/TMP/locale vars,
  `PW_CHANNEL`, `PLAYWRIGHT_BROWSERS_PATH`, and the storageState path vars `STORAGE_STATE`/`AUTH_STATE`
  that authored auth-reuse needs), forces `RUN_AUTHORED=1`, and drops everything else. `run_spec` uses
  it in place of `{ ...process.env }`.

## Consequences

- **+** Portable: pure Node, no container/Docker/VM; runs identically on the brain and in CI.
- **+** Closes the **secret-exfil** leg outright — the spec process cannot read host API keys/tokens,
  independent of any static-scan bypass.
- **+** Deterministically testable (no model, no quota): violating sources are rejected; a clean spec
  and a scrubbed env are asserted.
- **−** The capability scan is a **static** check, not a true sandbox: a determined obfuscation
  (`globalThis['pro'+'cess']`, string-built specifiers) could still construct a banned reference. This
  is an accepted residual — the env scrub bounds the blast radius, authored specs remain
  *untrusted-until-human-reviewed*, and OS-level isolation (Option 1) stays the documented future
  hardening if a stronger guarantee is needed.
- **−** A spec that legitimately needs a non-allowlisted env var must have it added to the allowlist
  (intentional — secrets are opt-in, not ambient).
- **−** The scan is line/text-based, not AST-aware, so it can **over-block**: an authored line whose
  *string literal* contains a module-specifier substring (e.g. `toHaveText("loaded from 'fs'")`) is
  rejected even though it imports nothing. This errs on the safe side (block, never silently allow);
  the author removes/rewords the literal. A token/AST-level scan would remove the false positive but
  is deliberately out of scope for this static guard.
