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

## Immediate next task — finish M3 interactive smoke (see PLAN)
**Done since M1.5:** browser tools factored into `src/browser-tools.mjs` (one source of truth, lazy
`getCtx`), shared by `bin/explore.mjs` and the **interactive extension**. The extension
(`extension/qa-focus/extension.mjs`) is the interactive front door: `browser_*` + `propose_locator`
(graded vs the current page) + `write_spec`/`run_spec` (authored test → real `playwright test` gate),
one live browser opened lazily. `src/copilot-path.mjs` resolves the copilot binary portably (fixes the
mini's Homebrew path). Verified: extension **loads + registers** in a copilot session.

**Gotchas to remember:**
- Copilot CLI extensions are **experimental** in 1.0.63 → must launch `copilot --experimental`.
  Discovery scans `.github/extensions/` for **real directories** (symlinks are skipped); we ship a
  one-line shim dir `.github/extensions/qa-focus/` that re-imports the canonical extension. In
  non-interactive `-p` mode, project extensions also need `GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS=true`.
- An extension **cannot remove** copilot's built-in tools (fs/shell) — interactive leash = human
  approval. The hard tool-gating leash only exists in the standalone harness (`bin/explore.mjs`).

**Production hardening (2026-06-22, see docs/STANDARDS.md + PLAN):**
- Complex surfaces: gate handles **iframes** (`frame`→frameLocator) + **open shadow DOM** (auto-pierced);
  **closed** shadow via `FORCE_OPEN_SHADOW=1`. Standards enforced as code (`src/standards.mjs` linter +
  `STANDARDS_PROMPT`). Shared `browser-tools.mjs` + `codify-tools.mjs`.
- **Gate-bypass fixed:** a real session log showed the model shelling around the gate in a Copilot
  *extension* (extensions can't cage built-in tools). **`bin/interactive.mjs`** is the enforcing
  interactive path (hard leash, stdin REPL) — verified end-to-end. The extension stays as the
  soft-leash convenience path.
- Explorer `STEP_BUDGET` (default 60) circuit breaker.

**Next:** (1) codifier → fixture-injected POMs + `storageState` auth reuse (research-recommended).
(2) M2 — live-verify electron/openfin surfaces. (3) finish M3 extension smoke at a TTY.

## Norms
Verify on a real signal (run the tests/app — don't guess twice). Surgical changes. Don't `git
commit` the memory store. Nothing here is pushed to GitHub yet (local-only).
