# Plan / roadmap

**Vision.** Control-first agentic QA that is model-agnostic (any model your installed Copilot
offers), surface-agnostic (web, Electron, OpenFin — all Chromium under the hood), and honest about
the two distinct jobs: an **explorer** that discovers (findings a human verifies) feeding a
**codifier** that hardens flows into deterministic, standards-compliant Playwright tests.

## Milestones

- **M0 — Foundation (DONE).**
  Deterministic locator gate (priority ladder + scoped tier + graceful degradation) proven on a
  clean app and a real hostile app (the-internet). Codifier (`bin/author.mjs`) runs live on the
  installed Copilot login. URL allowlist + tool-gating injection defense. Repo seeded, 13 tests green.

- **M1 — Live explorer smoke (DONE).**
  `bin/explore.mjs` drove the fixture app autonomously under the leash and emitted an artifact.
  (Surfaced: explorer verification should route through the gate — a naive `getByRole(listitem)`
  check produced a borderline false-positive finding.)

- **M1.5 — Adopt the Playwright CLI for browser actions (DONE — see ADR 0001).**
  The explorer's browser tools are now thin gated wrappers over `@playwright/cli` (`src/pwcli.mjs`):
  `browser_snapshot` returns compact `[ref=eN]` refs instead of an inline aria tree, and
  click/fill/press act by ref (~4x fewer tokens). Architecture: **our in-process Playwright owns the
  browser** (launched with `--remote-debugging-port`, so the gate, evidence collectors, and allowlist
  all watch the real page) and **the CLI attaches over CDP** to that same browser as the model's
  action surface. NO MCP, no raw shell (execFile + discrete argv preserves the injection defense).
  `browser_expect_visible` routes through the gate (`gradeLocator`): a non-unique/vague locator is
  rejected, and verification supports the accessible tiers (role+name or text) — the M1 listitem
  false-positive can no longer pass. Live-verified: copilot drove the fixture app end-to-end (add,
  edge cases, gate-checked asserts, a real usability finding).

- **M2 — Browser-provider abstraction (web | electron | openfin). SEAM BUILT.**
  `src/provider.mjs` exposes `openSurface({kind})`; the explorer targets any surface via `SURFACE=`.
  - **web** — `chromium.launch()` — *tested.*
  - **electron** — `_electron.launch({ args:[main] })`; windows are Pages, gate works unchanged —
    *needs a real Electron app to live-verify.*
  - **openfin** — `chromium.connectOverCDP(CDP_URL)`; multi-window via `contexts()/pages()` —
    *needs the RVM started with remote debugging to live-verify.*
  Remaining: live-verify electron + openfin against real desktop apps; multi-window selection helper.

- **M3 — Live extension smoke (PARTIALLY DONE).**
  The extension is now the **interactive front door**: `joinSession` registers the shared `browser_*`
  tools + `propose_locator` (graded against the current page) + `write_spec`/`run_spec`, opening one
  live browser lazily on first tool use. Discovery requires a **real directory** under
  `.github/extensions/` (symlinks are skipped — the loader's `dirent.isDirectory()` is false for them),
  so a one-line shim re-imports the canonical `extension/qa-focus/extension.mjs`.
  **Verified:** the extension loads + registers in a copilot session (`loaded 1 extension(s)`,
  "qa-focus extension loaded — browser+gate+codify tools active"). **Requires `copilot --experimental`**
  — extensions are an experimental, client-flag-gated feature in CLI 1.0.63 (in non-interactive `-p`
  mode also `GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS=true`).
  **Remaining:** observe a model completing a full flow purely through the registered tools in a real
  interactive TUI session (prompt-mode kept distorting model behavior — it inspected/reloaded the
  extension instead of calling the tools; the underlying tools, gate, and codify→run are independently
  verified working).

- **M4 — Explorer → codifier handoff.**
  Turn a discovered flow (explorer artifact) into a gated, authored spec automatically.

- **M5 — Full authoring pipeline.**
  PLAN → LOCATE → ASSERT → VERIFY around the gate; trace-driven healer on failure.

- **M6 — Packaging & distribution.**
  Copilot **plugin** (`plugin.json`) for one-line installs; CI integration; internal sharing.

## Production hardening (2026-06-22)

Driven by a real interactive session log + off-pool research (agy/Gemini). See `docs/STANDARDS.md`.
- **Complex surfaces** — the gate (`ladder.mjs`) now grades inside **iframes** (`frame` →
  `frameLocator`) and across **open shadow DOM** (auto-pierced); **closed** shadow roots reachable
  via `FORCE_OPEN_SHADOW=1` (rewrites `attachShadow` in `provider.mjs`). Tests: `ladder-complex.spec.ts`
  (6) + live `live-complex.spec.ts` (MDN web component + the-internet iframe). Limit: legacy
  `<frameset>` not surfaced inline; nested iframes are single-level today.
- **Standards enforced as code** — `src/standards.mjs` linter rejects authored specs with
  `waitForTimeout`/`networkidle`/`page.$`/XPath; `STANDARDS_PROMPT` (frames/shadow/Angular/CDK/virtual-scroll)
  re-injected each turn. Tests: `standards.spec.ts` (7).
- **Gate-bypass fixed (the key finding)** — the session log showed the model *shelling around* the
  gate in a copilot extension session (extensions can't cage built-in fs/shell tools). New
  **`bin/interactive.mjs`** is the enforcing interactive path: same hard leash as the explorer
  (`availableTools` caged + `onPreToolUse` deny), turn-by-turn over stdin. Verified end-to-end:
  model drove via gated tools only and the authored spec passed the real gate.
- **Shared modules** — `browser-tools.mjs` + `codify-tools.mjs` are the single implementations used by
  the explorer, the REPL, and the extension.

## Open questions / risks

- ~~Explorer is token-heavy and nondeterministic — needs a step budget + circuit breakers.~~
  DONE — `STEP_BUDGET` (default 60) caps tool calls in `bin/explore.mjs`.
- Codifier still emits flat specs; fixture-injected POMs + `storageState` auth reuse are the next
  production step (research-recommended). See `docs/STANDARDS.md`.
- OpenFin requires the runtime started with remote debugging enabled; confirm that's possible on
  the work apps.
- Prompt-injection defense (allowlist + tool-gating) needs an adversarial validation pass.
- Coordinate/CDP-input clicking is a deliberate *last-resort* for canvas/non-DOM only — accessible
  role+name actions stay primary.
