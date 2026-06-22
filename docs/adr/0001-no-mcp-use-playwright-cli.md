# ADR 0001 — No MCP; adopt the Playwright CLI model for browser actions

- Status: accepted
- Date: 2026-06-22

## Context

The agent needs browser-action capability (navigate/click/fill/read state). Three options:

1. **`@playwright/mcp`** — a server that loads 26+ tool schemas + streams the full accessibility
   tree inline into the model context. Verified cost: ~114k tokens for a task in Playwright's own
   benchmark.
2. **`@playwright/cli`** (Microsoft, early 2026) — the same tool engine exposed as terminal
   commands. Saves snapshots to disk as YAML and returns the model only a path + compact element
   refs (`e15`). ~4–10x fewer tokens (~27k vs 114k). Now the de-facto for coding agents; "Playwright
   MCP is shifting to Playwright CLI."
3. **Hand-rolled in-process tools** (our current `explore.mjs`) — full control, but our
   `inspect_aom` streams the entire `ariaSnapshot` inline = the *same* context-bloat MCP has.

## Decision

- **No MCP.** Confirmed too costly and being superseded for coding agents.
- **Adopt the `@playwright/cli` model** (disk snapshots + element refs) for the **explorer's**
  browser actions — but **wrap each CLI subcommand in a narrow, gated `defineTool`** rather than
  giving the model raw shell. This keeps the token efficiency of the CLI *and* our tool-gating
  prompt-injection defense (no fs/shell capability is exposed to the model).
- **Keep the locator GATE + codifier in-process** (Playwright API). The gate grades locators
  against a live `Page` (the priority ladder) — that is policy/judgment, not a browser command, and
  it is our non-commodity value. Neither MCP nor the CLI does this.

## Electron / OpenFin

- **OpenFin** — `@playwright/cli` can `attach` / connect to an existing Chromium via CDP
  (`browser.cdpEndpoint`); point it at OpenFin's `--remote-debugging-port`. No reinvention.
- **Electron** — basic: same CDP-attach if launched with `--remote-debugging-port`. Deep
  (main-process `evaluate`, dialog mocking, lifecycle) is **not** in the CLI → **extend** with a
  thin in-process `_electron.launch` adapter (`src/provider.mjs` already has it). This is the
  "extend the tools for Electron" path.

## Consequences

- ~4x lower token cost for autonomous exploration; context preserved for reasoning.
- We depend on `@playwright/cli` (pin the version; it is pre-1.0 — `0.1.x`).
- A thin wrapper preserves the leash and avoids reinventing browser primitives.
- The gate/codifier remain ours and in-process — no protocol, no extra process.
