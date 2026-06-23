# ADR 0007 — VS Code surface: an `@qa-focus` chat participant, not a tool or MCP

- Status: accepted
- Date: 2026-06-23
- Relates to: refines [ADR 0003](0003-distribution-native-adapters-no-mcp.md) (the IDE-embedding
  non-goal) and [ADR 0001](0001-no-mcp-use-playwright-cli.md) (no MCP).

## Context

We want qa-focus to run **directly inside GitHub Copilot in VS Code**, in addition to the standalone
CLI and the Copilot CLI plugin. ADR 0003 made IDE/editor embedding a *non-goal* on the premise that
editors accept third-party capabilities **only via MCP**, which the project rejects — being "a
passive tool-provider hosted inside someone else's agent" is incompatible with the control-first
thesis (the program owns the loop; the model fills typed holes; the gate verifies).

That premise is now out of date. Verified against the official VS Code API docs
(`code.visualstudio.com/api/extension-guides/chat` and `.../ai/tools`), VS Code has **two native,
non-MCP** extension paths into Copilot Chat:

- **Chat Participant API** (`contributes.chatParticipants` + `vscode.chat.createChatParticipant`) —
  GA. A participant "receive[s] the user's prompt and orchestrate[s] the tasks themselves," streaming
  its answer via `ChatResponseStream`. **The participant owns the turn.**
- **Language Model Tools API** (`contributes.languageModelTools` + `vscode.lm.registerTool`) — GA.
  Copilot's *agent mode* auto-invokes the tool. **The host owns the loop; we are a called tool.**

So the editor surface is reachable without MCP — but the two paths sit on opposite sides of the
control question.

## Decision

**Ship a VS Code extension that registers an `@qa-focus` *chat participant*.** It drives the same
SDK-free core + gated harness, owns its loop, runs the locator gate, and streams reasoning / tool
calls / results into the chat via `ChatResponseStream`. **No Language Model Tool, no MCP.**

This **refines, not reverses, ADR 0003.** ADR 0003 rejected being a *passive tool-provider*; that
still stands — we will **not** register a Language Model Tool or an MCP server. A chat participant is
the opposite posture: a first-class agent that the user explicitly invokes (`@qa-focus …`) and that
owns its control loop end-to-end. That is the thesis, surfaced in VS Code's chat — so the IDE is no
longer a non-goal *for the participant path specifically*.

## Options considered

1. **Chat participant `@qa-focus` (chosen).** We own the loop; non-MCP; thesis-consistent. Cost: a
   new VS Code extension package + its own activation/streaming glue.
2. **Language Model Tool.** Least code, broad agent-mode reach — but **control-inverted**: the host
   agent decides when to call us, so the gate/leash no longer owns the loop. Rejected: it is exactly
   the passive-tool posture ADR 0003 rejected, just without the MCP wire.
3. **MCP server.** Universal editor reach. Rejected: ADR 0001/0003 — token bloat, control inversion,
   reaffirmed "no MCP."
4. **A GitHub App chat participant** (github.com Copilot, not VS Code). Different surface; out of
   scope for "works in VS Code."

## Consequences

- A **new VS Code extension** package (e.g. `vscode/`) is added, reusing the portable core
  (`ladder`, `flow`, `healer`, `standards`, `provider`, `browser-tools`, `codify-tools`) and the
  control model. The `@github/copilot-sdk` seam stays narrow; the extension is a thin adapter.
- **Open implementation question for the issue:** drive the model via VS Code's native
  `vscode.lm.selectChatModels()` (gives model access + selection for free inside the editor) **or**
  embed the same `@github/copilot-sdk` harness the CLI uses. The first is more native; the second
  reuses the existing hard-leash exactly. To be decided when the issue is built.
- The live event→lines stream (`src/stream.mts`, #0013) and the cost meter (`src/cost.mts`, #0014)
  are reusable shapes for streaming into `ChatResponseStream`.
- Distribution stays git-based (ADR 0006) and zero-MCP (ADR 0001/0003) across all surfaces: CLI,
  Copilot-CLI plugin, and now the VS Code participant.
