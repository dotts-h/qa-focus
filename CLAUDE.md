# qa-focus — operating context for Claude Code

**What this is.** Control-first **agentic QA** on the GitHub Copilot SDK + Playwright. Two modes
that chain: an autonomous **explorer** (discovers flows/bugs, emits evidence a human verifies) feeds
a gated **codifier** (hardens flows into standards-compliant, durable Playwright tests). Thesis:
agent reliability is a *control* problem — the program owns the loop, the model fills typed holes, a
deterministic gate verifies every step. Uses the **installed `copilot` login** (no BYOK).

**Read first:** `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/adr/0001-no-mcp-use-playwright-cli.md`.

## Standing decisions (don't relitigate without cause)
- **No MCP, ever.** `@playwright/mcp` bloats context (~4× tokens: inline tool schemas + aria trees).
  Use the `@playwright/cli` model (disk snapshots + element refs) for browser actions — **wrapped in
  gated `defineTool` tools** so the model never gets raw shell (preserves the prompt-injection
  defense). See ADR 0001.
- **The gate + codifier stay in-process** (Playwright API). The locator-priority gate
  (`extension/qa-focus/ladder.mjs`) grades locators against a live `Page` — that's our non-commodity
  value, not a browser command.
- **Tool-gating is the security model.** Explorer holds only browser-action tools (no fs/shell/net)
  + a URL allowlist (`src/allowlist.mjs`).
- **Accessible actions first** (role+name). Coordinate/CDP-input clicking is a canvas-only last resort.
- **Surfaces:** web (`chromium`), Electron (`_electron.launch`), OpenFin (`connectOverCDP`) via
  `src/provider.mjs`. Electron deep-access needs the in-process `_electron` adapter (CLI can't).

## Layout
- `extension/qa-focus/` — the locator gate (`ladder.mjs`) + installable Copilot CLI extension
- `bin/author.mjs` — hard-gated codifier; `bin/explore.mjs` — autonomous explorer
- `src/{provider,allowlist,evidence}.mjs`; `fixtures/app/` sample app; `tests/` (deterministic, green)

## Run
- `PW_CHANNEL=chromium npm test` — deterministic gate + allowlist proofs (no model, no quota)
- `node bin/author.mjs` / `GOAL="…" node bin/explore.mjs` — live, uses the installed copilot login

## Immediate next task — M1.5 (see PLAN)
Replace the explorer's hand-rolled `inspect_aom`/`browser_*` tools (they stream the full aria tree
inline = the context bloat we're avoiding) with thin **gated wrappers over `@playwright/cli`**
(snapshot→refs, no inline tree, no shell exposed). Route explorer verification through the gate (the
live smoke produced a false-positive `getByRole('listitem')` finding — the gate would avoid it).

## Norms
Verify on a real signal (run the tests/app — don't guess twice). Surgical changes. Don't `git
commit` the memory store. Nothing here is pushed to GitHub yet (local-only).
