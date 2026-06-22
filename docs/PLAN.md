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

- **M1 — Live explorer smoke (NEXT).**
  Run `bin/explore.mjs` against the fixture app and a staging URL; confirm the autonomous agent
  drives the browser under the leash and emits a useful `artifacts/explore-report.md`. Measure
  cost/flakiness; decide step-budget defaults.

- **M2 — Browser-provider abstraction (web | electron | openfin). SEAM BUILT.**
  `src/provider.mjs` exposes `openSurface({kind})`; the explorer targets any surface via `SURFACE=`.
  - **web** — `chromium.launch()` — *tested.*
  - **electron** — `_electron.launch({ args:[main] })`; windows are Pages, gate works unchanged —
    *needs a real Electron app to live-verify.*
  - **openfin** — `chromium.connectOverCDP(CDP_URL)`; multi-window via `contexts()/pages()` —
    *needs the RVM started with remote debugging to live-verify.*
  Remaining: live-verify electron + openfin against real desktop apps; multi-window selection helper.

- **M3 — Live extension smoke.**
  Verify `extension/qa-focus/extension.mjs` inside an interactive `copilot` TUI session.

- **M4 — Explorer → codifier handoff.**
  Turn a discovered flow (explorer artifact) into a gated, authored spec automatically.

- **M5 — Full authoring pipeline.**
  PLAN → LOCATE → ASSERT → VERIFY around the gate; trace-driven healer on failure.

- **M6 — Packaging & distribution.**
  Copilot **plugin** (`plugin.json`) for one-line installs; CI integration; internal sharing.

## Open questions / risks

- Explorer is token-heavy and nondeterministic — needs a step budget + circuit breakers.
- OpenFin requires the runtime started with remote debugging enabled; confirm that's possible on
  the work apps.
- Prompt-injection defense (allowlist + tool-gating) needs an adversarial validation pass.
- Coordinate/CDP-input clicking is a deliberate *last-resort* for canvas/non-DOM only — accessible
  role+name actions stay primary.
