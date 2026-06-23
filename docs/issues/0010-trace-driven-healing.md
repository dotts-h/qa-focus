---
id: 0010
title: M5 trace-driven self-healing
status: closed
severity: low
group:
depends_on: []
github: 11
forgejo:
links:
  adr:
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
Extend `src/healer.mjs` (page-based, conservative) with a **trace-driven** heal: when a spec fails,
use the failure trace's captured DOM to recover an element the live page alone can't disambiguate —
still gate-verified, still never silently green-washing.

## Acceptance
- [x] Read the Playwright trace's DOM snapshot at the failing step — `extractTraceContext(snapshotPage,
      broken)` reads the snapshot DOM, pins the (then-unambiguous) intended element, and walks up to
      its nearest accessible ancestor scope (a named row/region/group).
- [x] Recover the intended element + re-grade through the gate; flag needs-confirmation —
      `healFromTrace(page, broken, traceCtx)` builds a SCOPED candidate (ladder tier 8) from the
      recovered scope, grades it on the live page, returns it `needsConfirmation`, and REFUSES when
      even the scope is not unique (no silent green-washing).
- [x] Deterministic test on a fixture where the page-based healer returns ambiguous but the trace
      resolves it — `tests/healer-trace.spec.ts` (6 cases): two identical "Edit" links → `healLocator`
      refuses; the trace's row scope → `healFromTrace` resolves uniquely; plus refuse/green-wash guards
      and the end-to-end snapshot→recover→re-grade path.

## Notes
Page-based healer shipped earlier; this is its documented next step. `extractTraceContext` operates
on the snapshot DOM loaded into a Page; pulling that HTML out of the `explore-trace.zip` is the thin
swappable integration step (the explorer already writes the trace). Core recover+re-grade logic is
implemented and deterministically tested.
