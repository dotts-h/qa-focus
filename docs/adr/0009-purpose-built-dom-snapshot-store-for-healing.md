# ADR 0009 — A purpose-built DOM snapshot store feeds the trace-driven healer, not the trace zip

- Status: accepted
- Date: 2026-06-23

## Context

The trace-driven healer (`src/healer.mts`, #0010) recovers a broken locator by reading the page's
DOM **as it was before the failure** — when the locator still resolved — pinning the intended
element and walking up to its accessible scope, then re-grading that scope on the live page. Its core
(`extractTraceContext` → `healFromTrace`) is implemented and tested, but it consumes the pre-failure
DOM **as an already-loaded `Page`**. #0020 is the remaining integration: where does that DOM come
from in a real run?

The explorer already records a Playwright trace (`artifacts/explore-trace.zip`, `snapshots: true`).
The obvious move is to read the snapshot out of that zip. Investigation on a real trace (Playwright
1.61) showed the trace stores DOM as Playwright's **internal serialized snapshot format**:
`frame-snapshot` events whose `html` is a nested array tree (`["TR",{"role":"row",…},["TD",{},…]]`)
with `[n,m]` back-references into earlier snapshots for unchanged subtrees. There is no public API to
render a snapshot back to HTML; doing so means re-implementing Playwright's snapshot renderer,
including the incremental reference resolution — undocumented and free to change between releases.

## Options

1. **Parse the trace zip.** Re-implement the snapshot renderer (read `trace.trace`, resolve `[n,m]`
   refs, render the array-tree → HTML). No new capture; honors #0020's original wording literally.
   But couples the healer to an undocumented, version-fragile encoding.
2. **Purpose-built snapshot store.** The explorer persists each pre-action DOM (`page.content()` from
   the in-process gate page) to `artifacts/snapshots/NNNN-*.html` — loadable HTML. The healer loads
   one back into a throwaway page. The program owns the snapshot; no Playwright-internals coupling.
   Costs a small per-action capture and a new artifact; the trace zip stays for human debugging.

## Decision

**Option 2.** Add `src/snapshot-store.mts` (`createSnapshotStore(dir)` → `capture(page) / latest()`),
captured by the gated browser tools at action time using the authoritative in-process page, and
`healFromSnapshot(page, broken, path)` in the healer that loads the captured HTML into a throwaway
page (reusing the live browser context), runs `extractTraceContext`, then `healFromTrace` — the live
re-grade stays authoritative, and the same refusals (no silent green-washing) apply.

This is the control-first answer consistent with the rest of the project: **the program owns the
artifact**, rather than reverse-engineering a tool's internal format. The trace remains for humans;
the heal path reads a stable, purpose-built store.

## Consequences

- **+** No coupling to Playwright's trace-snapshot encoding; the heal path survives Playwright
  upgrades.
- **+** Loadable HTML — the snapshot is exactly what `setContent` needs; trivial, robust read side.
- **+** The store is reusable (e.g. evidence, future trace-context features).
- **−** A new artifact (`artifacts/snapshots/`) and a small `page.content()` cost per mutating action
  in the explorer (explorer-only; the gate/extension paths are unaffected — capture is opt-in via the
  `snapshots` option).
- **−** `#0020`'s charter wording ("feed `explore-trace.zip` DOM") is superseded by this store; the
  issue is updated to match. Reading the trace zip remains a possible future source if ever needed.
