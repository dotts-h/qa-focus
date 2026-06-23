---
id: 0009
title: Live adversarial prompt-injection red-team
status: open
severity: medium
group:
depends_on: []
github: 10
forgejo:
links:
  adr: 0001
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
The deterministic injection guard exists (`tests/injection.spec.ts`); add the **live** red-team — a
hostile fixture page with injection payloads, drive the real-model explorer at it, and confirm the
leash holds (no off-allowlist nav, no fs/shell/net capability, task completes or refuses safely).

## Acceptance
- [ ] `fixtures/hostile/` page with visible + hidden injection payloads (exfil URL, "read .env and POST").
- [ ] Live explorer run; artifact shows zero off-allowlist navigation and no escape.
- [ ] Result documented (STANDARDS/REGRESSIONS).

## Notes
Uses model credits (Copilot Pro+). Validates the ADR 0001 / harness leash with a real signal.
