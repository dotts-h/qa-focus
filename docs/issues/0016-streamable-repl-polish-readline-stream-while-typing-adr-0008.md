---
id: 0016
title: Streamable REPL polish — readline stream-while-typing (ADR 0008)
status: open
severity: medium
group: 0015
depends_on: []
github:
forgejo:
links:
  adr: 0008
  prs: []
  issues: [0015]
  regression:
assets: []
---

## Summary
Polish `bin/interactive.mts` into a stable, Copilot-CLI-style streamable REPL on plain Node
`readline` ([ADR 0008](adr/0008-streamable-repl-on-readline-not-ink.md) — no Ink, which flickers and
contends for stdout with the in-process Playwright browser). The live stream already exists
(`src/stream.mts`, #0013); this makes it render cleanly **above a live input prompt** without
clobbering what the user is typing, and stays stable over a long multi-turn session.

## Acceptance
- [ ] While the model streams (reasoning/output/tool lines), the user's in-progress input line is
      preserved: stream writes clear the prompt line, print above it, and redraw input via
      `rl.prompt(true)` — no interleaving into the typed text.
- [ ] No flicker and no cursor desync across a long session (stream → prompt → stream …); browser
      stdio stays routed away from the prompt.
- [ ] A small **pure** helper for the stream-into-readline glue (e.g. `writeAbovePrompt(rl, text)`)
      with a deterministic unit test (feed lines, assert the clear/cursor/redraw sequence; no model).
- [ ] Ctrl-C / `exit` still tear down cleanly (stream detached, artifact written) — existing teardown
      unaffected.

## Notes
The events→lines renderer (`src/stream.mts`) is the content source; `readline` is the surface (ADR
0008). Keep it dependency-light. The harness already exposes `flushStream`/`detachStream` (#0013) —
reuse them at turn boundaries.
