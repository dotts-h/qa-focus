---
id: 0020
title: Trace-driven healer integration — feed explore-trace.zip DOM into the recover+re-grade core
status: open
severity: medium
group: 0019
depends_on: []
github: 39
forgejo:
links:
  adr:
  prs: []
  issues: [0010]
  regression:
assets: []
---

## Summary
Close the one deferred step from #0010 (M5 trace-driven self-healing): the recover+re-grade core
(`extractTraceContext` → `healFromTrace` in `src/healer.mts`) is implemented and deterministically
tested, but it consumes the DOM snapshot **as an already-loaded Page**. Pulling that snapshot HTML
out of the Playwright `explore-trace.zip` and loading it is the remaining "thin swappable
integration step". Wire it so a real failing run can heal from its own trace.

## Repro
1. Run the explorer (`bin/explore.mts`) — it writes `artifacts/explore-trace.zip`
   (`context.tracing.stop({ path })`, `bin/explore.mts:132`).
2. A later authored locator goes ambiguous on the live page; `healLocator` correctly refuses.
Expected: the failure trace's snapshot (captured when the locator still resolved) is read and fed to
`extractTraceContext` so `healFromTrace` can recover the scoped, gate-verified candidate.
Actual: there is no code path from `explore-trace.zip` → a Page → `extractTraceContext`; the core is
only exercised by tests that `setContent` hand-written HTML.

## Acceptance
- [ ] A function (e.g. `extractTraceSnapshot(traceZipPath, ...)`) reads the DOM snapshot HTML from a
      Playwright trace zip and loads it into a throwaway Page (closed after use).
- [ ] A higher-level `healFromTraceFile(page, broken, traceZipPath)` chains extract → `healFromTrace`,
      returning the same gate-verified, `needsConfirmation` result (and the same refusals — no silent
      green-washing).
- [ ] Deterministic test: produce a real trace zip in-test (start tracing, act, stop), then heal a
      deliberately-broken locator from that zip and assert the recovered scoped candidate (and a
      refusal case). No model, no quota.
- [ ] `make lint` + `make test` green.

## Notes
Seam: `src/healer.mts` (core, untouched) + a small trace-reader (new). The explorer already writes
the trace; this only adds the read side. Playwright trace zips store page snapshots — prefer reading
them via Playwright's own trace tooling over hand-parsing the zip if a stable API exists; otherwise
extract the snapshot entry from the zip and `setContent`/`goto` it. Keep the reader pure and
gate-authoritative: the live-page re-grade stays the source of truth. Context: #0010 acceptance box
marked `[~]` for exactly this step.
