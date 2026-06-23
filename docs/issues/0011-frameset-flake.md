---
id: 0011
title: Flaky legacy <frameset> degradation test under parallel load
status: closed
severity: low
group:
depends_on: []
github: 12
forgejo:
links:
  adr:
  prs: [feat/chrome-channel]
  issues: []
  regression: "REGRESSIONS #3"
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
Distinct from the fixed `CX_PORT` flake (REGRESSIONS #2). FIXED: the test now polls until the
nested `frame-middle` and its button are attached before grading (`expect.poll`, no fixed sleep),
so the gate's `page.frame({name})` lookup can't race the frame attach. Verified robust under heavy
parallelism (`--repeat-each 8 --workers 6` → 56/56). Guard: REGRESSIONS #3.
