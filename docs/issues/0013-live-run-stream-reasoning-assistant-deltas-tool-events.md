---
id: 0013
title: Live run stream (reasoning + assistant deltas + tool events)
status: closed
severity: medium
group: 0012
depends_on: []
github: 22
forgejo:
links:
  adr: 0002
  prs: []
  issues: [0012]
  regression:
assets: []
---

## Summary
Stream the model's work live to stdout (Copilot-CLI style) instead of going dark until the final
answer. The runners drive with blocking `session.sendAndWait(...)`; subscribe to the SDK event
stream via `session.on(...)` in the gated-session harness ([ADR 0002](adr/0002-extract-gated-session-harness.md))
so all three bins (`explore`/`codify`/`interactive`) render thinking, output, and tool calls as they
happen. **Build first** — this creates the shared event tap that #0014 (cost) rides.

## Acceptance
- [x] A **pure** `events → lines` renderer (`src/stream.mts`) — maps the SDK event union to display
      lines (`💭 …reasoning`, streamed assistant text, `🔧 browser_click(e5)` / `✓`/`✗`) — with
      **deterministic unit tests** (`tests/stream.spec.ts`, 17 cases; synthetic events in, output
      asserted; no model/quota).
- [x] `createGatedSession` attaches the subscription (`streaming: true` + `attachStreamRenderer`, the
      one seam per ADR 0002) and returns `detachStream`; all three bins render live and still get
      `sendAndWait`'s final result.
- [x] Verbosity gated: default-on, silenced with `--quiet` / `QA_QUIET` (no subscription, no writes,
      `streaming` left off — piped/CI runs pay nothing).
- [x] Opt-in live `explore` run shows the stream end-to-end: reasoning (`💭`), each gated tool call
      (`🔧 browser_fill(ref=e5, text=milk) ✓`), and the streamed final answer (rendered once).

## Notes
SDK events (verified in `@github/copilot-sdk/dist/generated/session-events.d.ts`):
`AssistantReasoningEvent` + `AssistantReasoningDeltaEvent` (thinking), `AssistantStreamingDeltaEvent`
/ `AssistantMessageDeltaEvent` (output), `ToolExecutionStartEvent` / `ToolExecutionProgressEvent` /
`ToolExecutionCompleteEvent` (tool calls). Subscribe with the typed `session.on(eventType, handler)`.
Keep the renderer pure so it's testable without the model; the harness owns the subscription so the
leash/tool-gating is untouched.
