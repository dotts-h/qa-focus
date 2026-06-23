---
id: 0021
title: Nested/multi-level iframe + inline frameset gate coverage
status: open
severity: medium
group: 0019
depends_on: []
github: 40
forgejo:
links:
  adr:
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
Lift two documented gate limits from the production-hardening pass: the locator gate
(`extension/qa-focus/ladder.mjs`) grades **single-level** iframes today (`frame` → `frameLocator`)
and does not surface legacy inline `<frameset>`/`<frame>` documents. Modern apps use single-level
`<iframe>` (works), but enterprise targets nest iframes and legacy apps still ship framesets.

## Repro
1. A target element lives inside an iframe that is itself inside another iframe (two levels deep).
Expected: the gate pierces both levels (chained `frameLocator(...).frameLocator(...)`) and grades
the element with the same accessible-tier rules.
Actual: only one level of `frame` is supported; a two-level-deep element is not reachable by the gate.

Plus: a legacy `<frameset>`/`<frame>` document's contents are not surfaced inline by the snapshot.

## Acceptance
- [ ] The gate grades an element nested **two levels deep** in iframes (multi-level `frameLocator`
      chaining), preserving the accessible-tier ladder.
- [ ] Inline `<frameset>`/`<frame>` content is surfaced/gradable (or, if out of scope, the limit is
      explicitly documented with the reason and a clear error rather than a silent miss).
- [ ] Deterministic fixtures + tests (extend `ladder-complex.spec.ts`): a 2-level nested-iframe case
      and a frameset case, asserting the gate grades / bounces correctly. No model, no quota.
- [ ] `make lint` + `make test` green; PLAN's "Limit: …nested iframes are single-level today" note
      updated.

## Notes
Seam: `extension/qa-focus/ladder.mjs` (frame traversal) + new fixtures under `fixtures/`. Builds on
the existing iframe/shadow-DOM grading from the 2026-06-22 production-hardening pass. Keep
closed-shadow / `FORCE_OPEN_SHADOW` behavior unchanged — this is strictly the frame axis.
