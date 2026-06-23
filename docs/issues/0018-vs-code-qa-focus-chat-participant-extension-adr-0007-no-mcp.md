---
id: 0018
title: VS Code @qa-focus chat participant extension (ADR 0007, no MCP)
status: closed
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
- [x] `contributes.chatParticipants` (`@qa-focus`) + `vscode.chat.createChatParticipant` with a
      `ChatRequestHandler` that **owns the turn** — parses the prompt, drives the qa-focus CLI, and
      streams the run into the chat via `ChatResponseStream` (`vscode/src/extension.ts`).
- [x] The handler runs the gated loop against a target app: `@qa-focus <url> <goal>` → `qa-focus
      explore --url … --goal … --quiet` (the gate/leash/model live in the CLI), output streamed to
      the chat. Web first (the CLI's default surface). The "live in Copilot Chat" check is by loading
      the extension in VS Code (F5 / VSIX) — not headlessly verifiable here; the parser + manifest +
      a clean `tsc` build are what CI guards.
- [x] **Zero MCP, zero Language Model Tool** — the only contribution is the chat participant
      (ADR 0007). Guarded by `tests/vscode-participant.spec.ts` (manifest has no `languageModelTools`/
      `mcpServers`; the source has no `registerTool`/MCP wiring; it does `createChatParticipant`).
- [x] Model path decided + documented: the participant drives the **git-installed qa-focus CLI**
      (which embeds the `@github/copilot-sdk` harness — the hard leash/tool-gating, ADR 0001/0002, is
      preserved). VS Code-native `vscode.lm` is a documented future option (ADR 0007 open question).
- [x] Installable VS Code extension (`vscode/`); the `main` entry is a **CJS bundle** built with
      **esbuild** (`out/extension.js`) — the proven VS Code extension format (the host loads `main`
      via `require()`); `tsc --noEmit` typechecks it against `@types/vscode`. `vscode/README.md`
      how-to (F5 dev host / `vsce package`). The pure parser is unit-tested (`parseChatRequest`,
      6 cases incl. trailing-punctuation) in the root suite.

## Notes
The Chat Participant API is GA and non-MCP (verified, `code.visualstudio.com/api/extension-guides/chat`).
The extension ships as a **CJS esbuild bundle** (VS Code's extension host requires CJS at `main`; a
native-ESM entry isn't reliable at engine `^1.95.0`). The pure parser lives in `request.mts` so the
root ESM test suite imports it directly while esbuild bundles it into the CJS output. Electron/OpenFin
surfaces inside the participant + the `vscode.lm` model path are follow-ups. **Closes epic #0015.**
