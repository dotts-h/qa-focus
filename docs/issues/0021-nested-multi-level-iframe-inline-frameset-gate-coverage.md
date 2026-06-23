---
id: 0021
title: Nested/multi-level iframe + inline frameset gate coverage
status: closed
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

## Resolution
`Proposal.frame` now accepts a **chain** (`string | string[]`): `gradeLocator` walks it with chained
`frameLocator(outer).frameLocator(inner).…` (new `frameChain` normalizer + `resolveFrameRoot` over an
array), and `render()` emits the matching base. Legacy `<frameset>` keeps degrading to the by-name
Frame API — and since `page.frame({name})` pierces the whole tree, a *nested* frame is reached by its
innermost name. The model-facing `frame` param (`browser_expect_visible`, `propose_locator`) accepts
the array form too.

## Acceptance
- [x] The gate grades an element nested **two levels deep** in iframes (multi-level `frameLocator`
      chaining), preserving the accessible-tier ladder. `fixtures/complex/nested-outer.html` →
      `nested-mid.html` → `inner.html`.
- [x] Legacy `<frameset>`/`<frame>` content remains gradable via the degraded by-name Frame API
      (nested frame reached by innermost name); the degrade is logged as debt (existing test kept).
- [x] Deterministic fixtures + tests (`ladder-complex.spec.ts`, now 9): a 2-level nested-iframe case
      (grades + renders the chained `frameLocator`), a single-element-chain equivalence case, and the
      frameset case. No model, no quota.
- [x] `npm run lint` + `PW_CHANNEL=chromium npm test` green (180 passed); PLAN limit note updated.

## Notes
Seam: `extension/qa-focus/ladder.mjs` (frame traversal) + new fixtures under `fixtures/`. Builds on
the existing iframe/shadow-DOM grading from the 2026-06-22 production-hardening pass. Keep
closed-shadow / `FORCE_OPEN_SHADOW` behavior unchanged — this is strictly the frame axis.
