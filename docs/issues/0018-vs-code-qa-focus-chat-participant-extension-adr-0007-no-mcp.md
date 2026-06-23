---
id: 0018
title: VS Code @qa-focus chat participant extension (ADR 0007, no MCP)
status: open
severity: medium
github:
forgejo:
group: 0015
depends_on: []
links:
  adr: 0007
  prs: []
  issues: [0015]
  regression:
assets: []
---

## Summary
Ship a VS Code extension that registers an **`@qa-focus` chat participant** ([ADR 0007](adr/0007-vscode-surface-chat-participant.md))
so qa-focus runs inside GitHub Copilot Chat in VS Code — **owning its loop**, not as a Language Model
Tool or MCP server. The participant drives the same SDK-free core + gated harness, runs the locator
gate, and streams reasoning / tool calls / results into the chat via `ChatResponseStream` (reusing
the events→lines shape from `src/stream.mts`, #0013).

## Acceptance
- [ ] `contributes.chatParticipants` (`@qa-focus`) + `vscode.chat.createChatParticipant` with a
      `ChatRequestHandler` that owns the turn (prompt → drive the leashed loop → stream the answer).
- [ ] The gated browser-action loop runs from the handler against a target app, on the **web/Chrome**
      surface at minimum; the locator gate verifies; output streams into the chat.
- [ ] **Zero MCP, zero Language Model Tool** — the participant is the only contribution (ADR 0007).
- [ ] Decide + document the model path: VS Code-native `vscode.lm.selectChatModels()` vs the embedded
      `@github/copilot-sdk` harness (ADR 0007 open question). Whichever — the hard leash/tool-gating
      (ADR 0001/0002) is preserved.
- [ ] Packaged as an installable VS Code extension (VSIX or from the repo); README how-to.

## Notes
The Chat Participant API is GA and non-MCP (verified, `code.visualstudio.com/api/extension-guides/chat`).
Electron/OpenFin surfaces inside the participant are a follow-up (web first). Keep the extension a
**thin adapter** over the portable core, like the other hosts — the SDK seam stays narrow.
