---
id: 0011
title: Flaky legacy <frameset> degradation test under parallel load
status: open
severity: low
group:
depends_on: []
github: 12
forgejo:
links:
  adr:
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
`tests/ladder-complex.spec.ts:86` (legacy `<frameset>` → Frame-API degradation) occasionally fails
under heavier parallel load; passes on re-run. Real nested-frame navigation timing sensitivity.

## Repro
1. Run the full suite with several added specs (more workers/contention): `PW_CHANNEL=chromium npm test`
Expected: all pass.
Actual: the frameset test (line 86) intermittently times out; green on re-run (CI has retries; local doesn't).

## Evidence
Observed 2026-06-23 during the M4/M5 work: one failure in ~3 full-suite runs, always this test.

## Notes
Distinct from the fixed `CX_PORT` flake (REGRESSIONS #2). Likely needs an explicit frame-ready wait
or isolating this spec from the heavy parallel pool. Low severity — CI retry masks it.
