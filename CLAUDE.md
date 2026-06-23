# qa-focus — operating context for Claude Code

**What this is.** Control-first **agentic QA** on the GitHub Copilot SDK + Playwright. Two modes
that chain: an autonomous **explorer** (discovers flows/bugs, emits evidence a human verifies) feeds
a gated **codifier** (hardens flows into standards-compliant, durable Playwright tests). Thesis:
agent reliability is a *control* problem — the program owns the loop, the model fills typed holes, a
deterministic gate verifies every step. Uses the **installed `copilot` login** (no BYOK).

**Read first:** `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/adr/0001-no-mcp-use-playwright-cli.md`.

## Standing decisions (don't relitigate without cause)
- **No MCP.** `@playwright/mcp` bloats context (~4× tokens). Use the `@playwright/cli` model (disk
  snapshots + element refs), **wrapped in gated `defineTool` tools** — model never gets raw shell.
  Full rationale: ADR 0001 + `docs/ARCHITECTURE.md`.
- **Tool-gating is the security model.** Explorer holds only browser-action tools + URL allowlist
  (`src/allowlist.mjs`). Hard leash lives in `src/harness.mjs`; extension is soft-leash only
  (can't remove copilot's built-in tools — use `bin/interactive.mjs` when enforcement matters).
  Full threat model: `docs/SECURITY.md`.
- **Accessible actions first** (role+name). Coordinate/CDP-input clicking is a canvas-only last resort.
- **Surfaces:** web (`chromium`), Electron (`_electron.launch`), OpenFin (`connectOverCDP`) via
  `src/provider.mjs`. Electron deep-access needs the in-process `_electron` adapter (CLI can't).

## Layout
- `extension/qa-focus/` — the locator gate (`ladder.mjs`) + installable Copilot CLI extension
- `bin/explore.mjs` — autonomous explorer; `bin/codify.mjs` — autonomous codifier; `bin/interactive.mjs` — enforcing REPL
- `src/harness.mjs` — the gated-session control model (one home for the hard leash, ADR 0002)
- `src/{provider,allowlist,evidence,browser-tools,codify-tools}.mjs`; `fixtures/app/` sample app; `tests/` (deterministic, green)

## Run
- `PW_CHANNEL=chromium npm test` — deterministic gate + allowlist proofs (no model, no quota)
- `GOAL="…" node bin/explore.mjs` / `GOAL="…" SPEC_NAME="…" node bin/codify.mjs` — live, uses the installed copilot login

## Status
Current state and next task: see `docs/PLAN.md` (v1 progress table + milestone log).

## Norms
Surgical changes; verify on a real signal (run the tests — don't guess twice). See `docs/CONVENTIONS.md`
for the full coding constitution. **Public repo** (Apache-2.0): no secrets, infra details, or internal
hostnames in committed files. Commit/push only when asked.
