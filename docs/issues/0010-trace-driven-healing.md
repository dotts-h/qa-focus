---
id: 0010
title: M5 trace-driven self-healing
status: open
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
- [ ] Read the Playwright trace's DOM snapshot at the failing step.
- [ ] Recover the intended element + re-grade through the gate; flag needs-confirmation.
- [ ] Deterministic test on a fixture where the page-based healer returns ambiguous but the trace resolves it.

## Notes
Page-based healer shipped this session; this is its documented next step.
