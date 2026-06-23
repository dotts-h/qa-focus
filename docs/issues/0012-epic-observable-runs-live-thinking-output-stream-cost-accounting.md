---
id: 0012
title: "Epic: Observable runs — live thinking/output stream + cost accounting"
status: closed
severity: medium
group:
depends_on: []
github: 21
forgejo:
links:
  adr: 0002
  prs: []
  issues: [0013, 0014]
  regression:
assets: []
---

## Summary
Make autonomous/interactive runs **observable**. Today all three runners (`bin/explore`, `codify`,
`interactive`) drive the model with blocking `session.sendAndWait(...)`, which returns only the
final text and **discards the entire Copilot SDK event stream** — so the operator sees nothing until
the end and has no idea what a run cost. Subscribing to that stream via `session.on(...)` unlocks two
operator-facing features off the **same event tap**:

- a **Copilot-CLI-style live stream** of the model's thinking, output, and tool calls ([#0013]);
- **per-run token + cost accounting**, surfaced even on direct shell runs ([#0014]).

The tap lands in the gated-session harness ([ADR 0002](adr/0002-extract-gated-session-harness.md)) —
the one home for how every runner drives the model — so all three bins get both features for free.

## Why now
The keystone CLI (#0006) is publish-ready; the next leverage is operability. Both features are
**first-class in the SDK** (verified in the local `@github/copilot-sdk` `.d.ts`) and need no API key
(they ride the installed `copilot` login). #0013 builds the event tap; #0014 rides it.

## Children
- [0013](0013-live-run-stream-reasoning-assistant-deltas-tool-events.md) — Live run stream (build first; creates the `session.on` event tap).
- [0014](0014-cost-usage-accounting-tokens-ai-credits-on-direct-shell-runs.md) — Cost & usage accounting (depends on 0013).

## Acceptance
- [x] #0013 merged (PR #25) — runs stream reasoning/output/tool events live; deterministic renderer tests.
- [x] #0014 merged — every run prints a token + AI-Credits summary; deterministic accumulator tests.
- [x] The event subscription lives once in the harness seam (ADR 0002): `createGatedSession` attaches
      both `attachStreamRenderer` (#0013, `quiet`-gated) and `attachCostMeter` (#0014, always-on),
      shared by all three bins.

## Notes
SDK event types (verified): `AssistantReasoningEvent`/`AssistantReasoningDeltaEvent`,
`AssistantStreamingDeltaEvent`/`AssistantMessageDeltaEvent`, `ToolExecutionStart|Progress|CompleteEvent`,
`AssistantUsageEvent`, `ModelBilling.tokenPrices`. Verification is deterministic for the pure
render/accumulate logic; the end-to-end live run is opt-in (needs the Copilot login), like the
existing `*_LIVE` tests.
