---
id: 0015
title: Epic: Multi-host runner — streamable REPL, headless model-select, VS Code participant
status: open
severity: medium
group: 
depends_on: []
github:
forgejo:
links:
  adr: 0007, 0008
  prs: []
  issues: [0016, 0017, 0018]
  regression:
assets: []
---

## Summary
Make qa-focus a **stable, streamable, model-selectable** agent that runs in **three host contexts**
and across **all three surfaces** (web/Chrome, Electron, OpenFin — already supported by
`src/provider.mts`). The hosts:

1. **Standalone CLI** (#0006, done) — a polished streamable REPL ([#0016](0016-streamable-repl-polish-readline-stream-while-typing-adr-0008.md))
   plus a headless one-shot run with model selection ([#0017](0017-headless-run-mode-model-selection-model-list-models.md)).
2. **GitHub Copilot CLI** — the native plugin ([#0007](0007-copilot-cli-plugin.md), git marketplace, no MCP).
3. **GitHub Copilot in VS Code** — an `@qa-focus` **chat participant** ([#0018](0018-vs-code-qa-focus-chat-participant-extension-adr-0007-no-mcp.md), [ADR 0007](adr/0007-vscode-surface-chat-participant.md), no MCP).

The thread through all three: the program owns the loop, the model fills typed holes, the gate
verifies — surfaced as a clean streaming UX. Built on the live event→lines stream (`src/stream.mts`,
#0013) and the cost meter (`src/cost.mts`, #0014).

## Why now
The v1 CLI deliverable is done and git-distributed (#0006, ADR 0006). The next leverage is **reach +
UX**: a stable streamable REPL, model choice on direct runs, and first-class presence in the two
Copilot hosts — all **without MCP** (ADR 0001/0003/0007). Research (verified, 2026) confirmed the
non-MCP paths: `readline` for the REPL (ADR 0008) and a VS Code chat participant that owns its loop
(ADR 0007).

## Children
- [0016](0016-streamable-repl-polish-readline-stream-while-typing-adr-0008.md) — Streamable REPL polish (readline stream-while-typing).
- [0017](0017-headless-run-mode-model-selection-model-list-models.md) — Headless run mode + model selection.
- [0018](0018-vs-code-qa-focus-chat-participant-extension-adr-0007-no-mcp.md) — VS Code `@qa-focus` chat participant.

(The Copilot-CLI plugin [#0007] and the GitHub Action [#0008] live under the v1 epic #0001 and
complete the multi-host story.)

## Acceptance
- [ ] #0016 merged — the REPL streams reasoning/output/tool lines above a live prompt, no flicker, stable across a long session.
- [ ] #0017 merged — `--list-models` / `--model` select the Copilot model; a headless one-shot run works (CI/pipe friendly).
- [ ] #0018 merged — `@qa-focus` chat participant runs in VS Code Copilot Chat, owning its loop, zero MCP.
- [ ] All three surfaces (web/Electron/OpenFin) reachable from at least the CLI host; documented.
