---
id: 0020
title: Trace-driven healer integration — feed explore-trace.zip DOM into the recover+re-grade core
status: closed
severity: medium
group: 0019
depends_on: []
github: 39
forgejo:
links:
  adr: 0009
  prs: []
  issues: [0010]
  regression:
assets: []
---

## Summary
Close the one deferred step from #0010 (M5 trace-driven self-healing): the recover+re-grade core
(`extractTraceContext` → `healFromTrace` in `src/healer.mts`) is implemented and deterministically
tested, but it consumes the DOM snapshot **as an already-loaded Page** — there was no code path from
a real run's captured DOM into it. Wire it so a real failing run can heal from a captured pre-failure
snapshot.

**Design pivot (ADR 0009).** Investigation showed the Playwright `explore-trace.zip` stores DOM in an
*internal serialized snapshot format* (nested arrays + `[n,m]` back-refs), not loadable HTML —
reading it means re-implementing Playwright's snapshot renderer against an undocumented,
version-fragile encoding. We instead added a **purpose-built snapshot store**: the explorer persists
each pre-action DOM (`page.content()` from the authoritative in-process gate page) as loadable HTML,
and the healer loads one back. Control-first (the program owns the artifact), no Playwright-internals
coupling. The trace zip stays for human debugging.

## Repro
1. Run the explorer (`bin/explore.mts`) — each mutating action now captures the page DOM to
   `artifacts/snapshots/NNNN-*.html` (the in-process gate page, ADR 0009).
2. A later authored locator goes ambiguous on the live page; `healLocator` correctly refuses.
Expected: `healFromSnapshot(page, broken, snapshotPath)` reads the pre-failure DOM, recovers the
scoped accessible candidate, and re-grades it on the live page (gate-verified).
Actual (before): no path from a captured DOM → `extractTraceContext`; the core was only exercised by
tests that `setContent` hand-written HTML.

## Acceptance
- [x] `src/snapshot-store.mts` (`createSnapshotStore(dir)` → `capture(page) / latest()`) persists the
      page's DOM as loadable HTML; capture never throws (returns null on failure).
- [x] `healFromSnapshot(page, broken, snapshotPath)` (`src/healer.mts`) reads the snapshot HTML, loads
      it into a throwaway page (reusing the live context, closed after use), chains
      `extractTraceContext` → `healFromTrace` — same gate-verified `needsConfirmation` result, same
      refusals (no silent green-washing).
- [x] Wired into the explorer: `bin/explore.mts` creates the store and the gated browser tools capture
      the pre-action DOM before each `click` / `fill` / `press`.
- [x] Deterministic tests: `tests/snapshot-store.spec.ts` (3) + `tests/healer-snapshot.spec.ts` (3) —
      capture writes loadable HTML, heal-from-file resolves the scoped candidate, and refuses when the
      snapshot can't disambiguate / the file is missing. No model, no quota.
- [x] `npm run lint` + `PW_CHANNEL=chromium npm test` green (161 passed).

## Notes
Seam: `src/healer.mts` (core untouched; one new `healFromSnapshot`) + new `src/snapshot-store.mts` +
opt-in `snapshots` capture in `src/browser-tools.mts` (explorer-only — the gate/extension paths are
unaffected). The live-page re-grade stays authoritative. Decision recorded in ADR 0009. Context:
#0010 acceptance box marked `[~]` for exactly this step.
