---
id: 0014
title: Cost & usage accounting (tokens + AI-Credits, on direct shell runs)
status: closed
severity: medium
group: 0012
depends_on: [0013]
github: 23
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
- [x] A **pure** `accumulateUsage(records) → summary` (`src/cost.mts`) — sums input/output/cache/
      reasoning tokens per model and prices AI-Credits — with **deterministic unit tests**
      (`tests/cost.spec.ts`, 11 cases; synthetic `AssistantUsageEvent.data` + a fixed credits→$ rate
      → asserted summary/lines; no model/quota).
- [x] Every `explore`/`codify`/`interactive` run prints the summary at the end (direct shell
      included) — explore via the artifact echo, codify/interactive via `renderCostSummary`. The
      `assistant.usage` tap is `quiet`-independent, so piped/CI runs still get it.
- [x] The summary is folded into the evidence artifact (`renderArtifact` "## Usage & cost") and
      `explore-flow.json` (`flow.usage`).
- [x] Reports **tokens always**; reports **AI-Credits** from the authoritative
      `copilotUsage.totalNanoAiu` (1 AIU = 1e9 nano) when present; an optional user-set credits→$
      rate (`QA_AIU_USD`) adds a `$` estimate. Verified live: `27,543 in + 269 out, 10,855
      cache-read, 17 reasoning across 5 requests → 6.9866 AI-Credits` (claude-sonnet-4.6).

## Implementation note
The SDK carries the priced AI-Credits cost per request in `copilotUsage.totalNanoAiu`, so we sum
that directly rather than re-pricing tokens against `ModelBilling.tokenPrices` — the runtime's own
figure is the honest one. `$` is only ever an estimate from a user-supplied rate.

## Notes
SDK (verified): `AssistantUsageEvent.data` carries input/output/`cacheReadTokens`/`cacheWriteTokens`/
reasoning tokens per model + completion id; `ModelBilling.tokenPrices` (`inputPrice`/`outputPrice`/
`cacheReadPrice`) is **denominated in Copilot AI Credits**, not USD — so honest output is tokens +
AI-Credits, with `$` only as an optional user-supplied-rate estimate. `ShutdownModelMetricUsage` gives
a final per-model rollup as a cross-check. Depends on #0013 (the `session.on` subscription).
