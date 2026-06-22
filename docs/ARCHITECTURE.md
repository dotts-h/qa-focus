# Architecture

## The two-phase model: explorer → codifier

| | Explorer (`bin/explore.mjs`) | Codifier (`bin/author.mjs`, `extension/`) |
|---|---|---|
| Goal | Discover flows, bugs, evidence | Produce durable, standards-compliant tests |
| Output | Findings + artifact (human-verified) | Validated Playwright locators/specs |
| Determinism | Nondeterministic by design | Deterministic, gate-verified |
| Trust | Reported, never self-certified | Safe to gate a release |

The explorer **finds**; the codifier **hardens** the worthwhile flows. Neither replaces the other;
trying to get durable tests out of an autonomous explorer is the trap this project exists to avoid.

## Control is the engine

Both modes are the same shape: **the program owns the loop, the model fills typed holes, a
deterministic gate verifies each step.** Implemented with Copilot SDK primitives:

- `availableTools` (custom-only `ToolSet`) — the model's entire capability surface for a phase.
- custom typed tools (`defineTool`) — the only way to act; the schema *is* the standard.
- `hooks.onPreToolUse` / `onUserPromptSubmitted` — per-call policy + state/standards re-injection.
- `RuntimeConnection.forStdio` — reuse the installed CLI's login; model-agnostic via Copilot.

## The locator gate (`extension/qa-focus/ladder.mjs`)

Enforces Playwright's priority order on the *live page*, deriving higher-priority alternatives from
the resolved element so it can't be fooled:

```
role > label > placeholder > text > altText > title > testid > scoped > css/xpath
```

- bounces lazy CSS up to the highest accessible tier that uniquely resolves;
- for non-unique names, prefers a **scoped accessible** locator (`getByRole('row',{name}).…`);
- degrades to CSS/XPath only when no accessible handle exists — with a required reason, logged as
  accessibility debt (a backlog for the app team, not silent fragility).

## Mapping to Antigravity's browser-agent architecture

| Antigravity pillar | qa-focus equivalent |
|---|---|
| Manager View (orchestrator + sub-agents) | Copilot SDK orchestration (`fleet.start` / planner→executor) |
| Native CDP via WebSocket + MCP tools | Playwright (a CDP client); Playwright MCP / custom `defineTool` browser tools; `context.newCDPSession()` for low-level intercepts |
| Evidence → Markdown artifacts | `context.tracing` + `page.on(console/requestfailed/response)` → `src/evidence.mjs` |
| URL allowlist + injection mitigation | `src/allowlist.mjs` **plus** tool-gating (no fs/shell/network tools exist in the browser phase) |

Deliberately **not** copied: "precise coordinate clicking." Coordinate clicks are brittle (the very
thing the gate avoids) — actions are accessible role+name first; coordinate/CDP input is a future
canvas-only fallback.

## Next

1. Live smoke of `explore.mjs` against the fixture app (and a staging URL), verify the artifact.
2. Live smoke of the extension inside an interactive `copilot` TUI session.
3. The explorer→codifier handoff: turn a discovered flow into a gated authored spec automatically.
4. PLAN / ASSERT / VERIFY phases around LOCATE for full test authoring.
