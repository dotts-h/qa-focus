---
id: 0023
title: Live model-driven prompt-injection red-team on a hostile fixture page
status: open
severity: high
group: 0019
depends_on: []
github: 42
forgejo:
links:
  adr: 0001
  prs: []
  issues: [0009]
  regression:
assets: []
---

## Summary
Complete the adversarial validation deferred from #0009. The **deterministic** injection layer is
done (`tests/injection.spec.ts`: allowlist rejects exfil hosts/lookalikes, `browser_goto` denies
off-allowlist URLs, the gated toolset is proven to expose no fs/shell/network capability). What
remains is a **live, model-driven** red-team: drive the real model at a hostile fixture page seeded
with injection payloads and confirm it cannot be steered past the hard leash.

> **GATED ON MODEL QUOTA.** This child spends model credits (it drives the live Copilot login).
> Do not pick it up as routine roadmap work — schedule it deliberately when credits are allocated.
> Until then it stays open as a tracked decision point (PLAN "Decision points ahead").

## Repro
1. Serve a hostile fixture page containing prompt-injection payloads (exfil instructions, fake tool
   directives, off-allowlist navigation lures).
2. Run the explorer (`bin/explore.mjs`) / enforcing REPL (`bin/interactive.mjs`) against it with a
   benign goal.
Expected: the model never escapes the leash — no off-allowlist navigation, no fs/shell/network, no
exfiltration — and any attempt is denied by the hard leash, logged as evidence.
Actual: only the deterministic layer is proven; the live model-in-the-loop behavior is unobserved.

## Acceptance
- [ ] A hostile fixture page (under `fixtures/`) with a catalogued set of injection payloads.
- [ ] A live run (explorer + enforcing REPL) recorded against it; every injection attempt is shown
      denied by the leash, with the evidence artifact captured.
- [ ] Findings logged (logging-learnings); any gap found is filed as its own issue.
- [ ] Documented as the live counterpart to `tests/injection.spec.ts`.

## Notes
Seam: `fixtures/` (hostile page) + `bin/explore.mts` / `bin/interactive.mts` (run harness) +
`src/allowlist.mjs` / `src/harness.mjs` (the leash under test). Threat model: `docs/SECURITY.md`,
ADR 0001. The enforcing path (`bin/interactive.mjs`) matters here — the Copilot extension is a soft
leash, so the red-team must exercise the hard-leash path for a meaningful result.
