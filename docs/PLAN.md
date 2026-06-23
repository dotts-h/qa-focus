# Plan / roadmap

**Vision.** Control-first agentic QA that is model-agnostic (any model your installed Copilot
offers), surface-agnostic (web, Electron, OpenFin — all Chromium under the hood), and honest about
the two distinct jobs: an **explorer** that discovers (findings a human verifies) feeding a
**codifier** that hardens flows into deterministic, standards-compliant Playwright tests.

## v1 — definition of done

qa-focus v1 is a **CLI / CI deliverable** — **no MCP, no IDE embedding** (ADR 0003), shipped as a
typed package (ADR 0004). Two acceptance axes:

**A. Surface coverage — the gate + explorer + codifier work, live-verified, on all three:**
- **web (Chrome channel)** — `PW_CHANNEL=chrome` (branded Chrome, not just bundled Chromium), since
  target apps run there.
- **Electron** — done at the gate layer (`tests/live-electron.spec.ts`); v1 extends to the
  explorer/codifier path (an in-process action surface, since the CLI can't attach over CDP).
- **OpenFin** — `connectOverCDP` to the RVM started with `--remote-debugging-port` (set via the app
  manifest's `runtime.arguments`); windows are Pages. **Needs Windows/macOS infra** (no Linux
  runtime) + a free OpenFin developer license + a test `app.json`. Live-verify on the Mac mini or a
  Proxmox Windows VM.

**B. Deliverable — installable CLI tools (ADR 0003), all non-MCP:**
- **Standalone CLI** published to npm — `qa-focus explore | codify | interactive`.
- **Copilot CLI plugin** — `plugin.json` + git-marketplace install.
- **GitHub Action** — run explore/codify/the authored gate in CI.

Tracked as the **v1 epic** (#0001) in `docs/issues/`.

### v1 progress (2026-06-23)

| issue | item | status |
|------|------|--------|
| #0006 | `qa-focus` CLI entrypoint (explore/codify/interactive; flags→env) | **scaffold shipped** (JS); publish gated on #0005 |
| #0003 | web Chrome-channel coverage | **done** — suite green on `PW_CHANNEL=chrome`, documented |
| #0011 | frameset flake | **done** — fixed + guarded (REGRESSIONS #3) |
| #0005 | TypeScript migration + typed npm package | **next** — the foundation; unblocks publish, #0007, #0008 |
| #0004 | Electron explorer in-process action path | open |
| #0007 / #0008 | Copilot plugin / GitHub Action | open (gated on the npm publish) |
| #0009 | live injection red-team | open (spends model credits) |
| #0010 | trace-driven self-healing | open |
| #0002 | **OpenFin** live-verify | **DONE (#0024)** — live-verified on the M4 Mac mini (RVM 44.146.101.4); Rosetta 2 + GUI session required (fixture README) |

**Recommended next:** #0005 (TypeScript migration) — a focused, single-purpose pass. Decision points
ahead: the OpenFin infra (Mac mini vs Windows VM) and whether to spend credits on the #0009 red-team.

## Milestones

- **M0 — Foundation (DONE).**
  Deterministic locator gate (priority ladder + scoped tier + graceful degradation) proven on a
  clean app and a real hostile app (the-internet). Codifier (`bin/codify.mjs`) runs live on the
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
  - **electron** — `_electron.launch({ args:[appDir] })`; windows are Pages, gate works unchanged —
    **LIVE-VERIFIED.** `fixtures/electron/` (a real Electron app) + `tests/live-electron.spec.ts`
    (`ELECTRON_LIVE=1 xvfb-run -a …`): the gate grades a role+name button and bounces raw CSS to
    the accessible tier inside a real Electron window, identical to web. Gotcha: launch the app
    **directory** (package.json `main`), not a bare `main.js` (REGRESSIONS #1). The explorer's CLI
    action-surface can't attach to Electron (no CDP endpoint), so it uses the **in-process action
    driver** (`src/inproc-driver.mts`, ADR 0005) instead — and the **full autonomous explore→codify
    loop is now LIVE-VERIFIED on Electron** (#0026, 2026-06-23): a real Copilot model snapshotted +
    acted by ref through the in-process driver on `fixtures/electron/` under `xvfb`, the codifier
    authored a gate-clean spec whose role+name locators were validated against the live Electron
    window. The live run caught + fixed a real production bug — the in-process snapshot threw
    `__name is not defined` under the `tsx`/esbuild runtime the binaries use (REGRESSIONS #5).
    **Remaining (follow-up #0027):** the codifier authors a *web-shaped* spec (`{ page }` + `goto`)
    regardless of surface, so the executed `run_spec` runs on web; a surface-aware authored-spec
    template that executes against Electron (`_electron.launch`) is the next step.
  - **openfin** — `chromium.connectOverCDP(CDP_URL)`; multi-window via `contexts()/pages()` —
    **LIVE-VERIFIED** on a real OpenFin RVM (runtime 44.146.101.4) on the M4 Mac mini (#0024,
    2026-06-24): the gate grades `heading "Todo"` inside an OpenFin window, raw CSS bounces to the
    accessible tier, and multi-window enumeration works (`tests/live-openfin.spec.ts`, `OPENFIN_LIVE=1`).
    The live run also caught a real bug — the default window selection drove OpenFin's
    `openfin-internal://blank` provider window; `firstAppWindow`/`isInternalWindow` now skip it
    (REGRESSIONS #4). RVM-on-Apple-Silicon needs Rosetta 2 + a GUI session (see fixture README).

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

- **M4 — Explorer → codifier handoff (MECHANISM DONE).**
  The explorer now emits a structured, machine-readable flow (`artifacts/explore-flow.json`):
  DURABLE semantic steps (`goto`/`click`/`fill`/`press`/`expect` by accessible role+name, parsed
  from each snapshot's `[ref=eN]` → role/name — never the ephemeral refs themselves). The codifier
  consumes it with `FLOW=artifacts/explore-flow.json`, which seeds the GOAL/START_URL and prepends
  the discovered recipe to the model's prompt. Control-first: the flow is a SEED to re-walk and
  gate-harden, never trusted output (the gate still grades every locator live). New `src/flow.mjs`,
  wired through the shared `browser-tools.mjs`; deterministic `tests/flow.spec.ts` (5) + a no-model
  end-to-end smoke verified the full pwcli→gate→flow path. **LIVE-VERIFIED:** a real Copilot-model
  explorer drove the fixture autonomously and emitted the durable flow; that flow then produced a
  green authored spec through the real gate. **FULLY LIVE-VERIFIED (model-authored):** seeded with
  `FLOW=artifacts/explore-flow.json`, the real Copilot model walked the recipe, gate-accepted its
  locators via `propose_locator`, and authored `tests/authored/todo-add-live.spec.ts` (hoisted
  locators + a tolerant consent dismissal) that passes `run_spec` — one ~67s run. The explore→codify
  handoff is closed end-to-end with no human in the authoring loop. **M4 DONE.**

- **M5 — Full authoring pipeline. SELF-HEALING STARTED.**
  PLAN → LOCATE → ASSERT → VERIFY around the gate; healer on failure. A conservative,
  gate-verified **page-based healer** is built (`src/healer.mjs`, `heal_locator` codify tool):
  when an authored locator stops resolving, it proposes a replacement ONLY when the gate cleanly
  accepts a unique candidate (role-drift with a stable name → re-roled locator; name-drift on a
  unique element → role-only), refuses ambiguous recovery, and NEVER silently green-washes a test
  (every heal is flagged needs-confirmation). Tests: `tests/healer.spec.ts` (4). A **trace-driven**
  healer (`extractTraceContext` → `healFromTrace`) recovers the intended element's accessible scope
  when the live page alone is ambiguous (#0010), and is now **wired to a real artifact** (#0020, ADR
  0009): the explorer captures each pre-action DOM to a purpose-built snapshot store
  (`src/snapshot-store.mts`, loadable HTML — not the trace zip's internal format) and
  `healFromSnapshot(page, broken, path)` heals from it, still gate-verified, still refusing rather
  than green-washing. Tests: `tests/healer-trace.spec.ts` (6) + `tests/snapshot-store.spec.ts` (3) +
  `tests/healer-snapshot.spec.ts` (3).

- **M6 — Packaging & distribution.**
  Copilot **plugin** (`plugin.json`) for one-line installs; CI integration; internal sharing.

## Production hardening (2026-06-22)

Driven by a real interactive session log + off-pool research (agy/Gemini). See `docs/STANDARDS.md`.
- **Complex surfaces** — the gate (`ladder.mjs`) grades inside **iframes** — including **nested**
  ones: `frame` accepts an outer→inner selector chain rendered as
  `frameLocator(outer).frameLocator(inner).…` (#0021) — and across **open shadow DOM** (auto-pierced);
  **closed** shadow roots reachable via `FORCE_OPEN_SHADOW=1` (rewrites `attachShadow` in
  `provider.mjs`). Legacy `<frameset>/<frame>` degrades to the by-name Frame API (`page.frame({name})`
  pierces the whole tree, so a nested frame is reached by its innermost name). Tests:
  `ladder-complex.spec.ts` (9, incl. 2-level nesting + frameset) + live `live-complex.spec.ts` (MDN
  web component + the-internet iframe).
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
- ~~Codifier still emits flat specs; fixture-injected POMs + `storageState` auth reuse are the next
  production step (research-recommended).~~ DONE — `write_pom` authors a linted Page Object under
  `tests/authored/<name>.pom.ts` (held to the same locator/standards gate as specs); authored specs
  import `tests/authored/fixtures.ts` to reuse a captured login (`save_auth` → storageState) and fall
  back to unauthenticated when none exists (`src/authored.mjs` `resolveStorageState`). Worked example:
  `tests/authored/todo.pom.ts` + `todo-pom.spec.ts` (green under `RUN_AUTHORED=1`). See `docs/STANDARDS.md`.
- OpenFin requires the runtime started with remote debugging enabled; confirm that's possible on
  the work apps.
- ~~Prompt-injection defense (allowlist + tool-gating) needs an adversarial validation pass.~~
  DETERMINISTIC LAYER DONE — `tests/injection.spec.ts` asserts both layers as code: the allowlist
  rejects an injected exfil host/lookalike, `browser_goto` denies an off-allowlist URL even when
  "tricked" into calling it, and the gated toolset is proven to expose NO fs/shell/network
  capability (capability-absence, not just restriction). Remaining: a live model-driven red-team on
  a hostile fixture page (needs quota).
- Coordinate/CDP-input clicking is a deliberate *last-resort* for canvas/non-DOM only — accessible
  role+name actions stay primary.
