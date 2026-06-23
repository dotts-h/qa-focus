---
id: 0016
title: Streamable REPL polish — readline stream-while-typing (ADR 0008)
status: closed
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
- [x] While the model streams, the user's in-progress input is preserved: each complete line is
      cleared/printed-above/redrawn via `rl.prompt(true)`. The harness gained a `streamWrite` sink;
      interactive late-binds a readline-aware writer and keeps the prompt LIVE during the turn (TTY)
      so the user can type the next goal ahead. Verified live in a pty (cheap model): streamed lines
      render above `you> <input>` with the `[2K[1G…\n` + prompt-redraw sequence, input intact.
- [x] No flicker / cursor desync (readline only touches the prompt line, ADR 0008); browser stdio
      stays off the prompt (the surface is headless and routes logs through the evidence sink). Only
      a real TTY gets the redraws — a piped/`--quiet` run keeps plain stdout for clean capture.
- [x] **Pure** helpers (`src/repl.mts`): `createLineWriter` (buffers partial chunks → complete lines)
      + `writeAbovePrompt(surface, text)` (clear → cursor → write → redraw, injected surface).
      `tests/repl.spec.ts` (5 cases) asserts the line-split + the exact clear/cursor/write/redraw order.
- [x] `exit`/`quit` and teardown unchanged — `detachStream` + `saveArtifact` still run; the loop break
      is untouched.

## Notes
The events→lines renderer (`src/stream.mts`) is the content source; `readline` is the surface (ADR
0008). Keep it dependency-light. The harness already exposes `flushStream`/`detachStream` (#0013) —
reuse them at turn boundaries.
