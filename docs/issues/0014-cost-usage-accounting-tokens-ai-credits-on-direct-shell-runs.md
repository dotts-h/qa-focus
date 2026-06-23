---
id: 0014
title: Cost & usage accounting (tokens + AI-Credits, on direct shell runs)
status: open
severity: medium
group: 0012
depends_on: [0013]
github:
forgejo:
links:
  adr: 0002
  prs: []
  issues: [0012]
  regression:
assets: []
---

## Summary
Report what a run **cost** — surfaced even when `explore`/`codify`/`interactive` are run directly
from the shell. Riding the event tap from #0013, accumulate per-turn usage across a run and print a
token + cost summary at the end (and fold it into the evidence artifact + `explore-flow.json`).

## Acceptance
- [ ] A **pure** `accumulate(usageEvents) → summary` function (`src/cost.mts`?) — sums input/output/
      cache/reasoning tokens per model and prices them — with **deterministic unit tests** (synthetic
      `AssistantUsageEvent`s + a fixed price table → expected summary; no model/quota).
- [ ] Every `explore`/`codify`/`interactive` run prints the summary at the end (direct shell included).
- [ ] The summary is folded into the evidence artifact (`renderArtifact`) and `explore-flow.json`.
- [ ] Reports **tokens always**; reports **AI-Credits** when the model exposes `tokenPrices`; an
      optional user-set credits→$ rate (env) adds a `$` estimate.

## Notes
SDK (verified): `AssistantUsageEvent.data` carries input/output/`cacheReadTokens`/`cacheWriteTokens`/
reasoning tokens per model + completion id; `ModelBilling.tokenPrices` (`inputPrice`/`outputPrice`/
`cacheReadPrice`) is **denominated in Copilot AI Credits**, not USD — so honest output is tokens +
AI-Credits, with `$` only as an optional user-supplied-rate estimate. `ShutdownModelMetricUsage` gives
a final per-model rollup as a cross-check. Depends on #0013 (the `session.on` subscription).
