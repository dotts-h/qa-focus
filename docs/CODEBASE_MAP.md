# CODEBASE_MAP.md — qa-focus

> How the repo is organized: module layout, entry points, the primary data-flow path, and the
> architectural seams. Regenerate after a structural change. The *why* of decisions lives in
> [docs/adr/](adr/README.md); the *contracts* between these modules live in [CONTRACTS.md](CONTRACTS.md).

## Entry points (`bin/`)

| File | Mode | Leash | What it does |
|------|------|-------|--------------|
| `bin/explore.mjs` | autonomous explorer | HARD | roams an app toward `GOAL`, emits an evidence artifact |
| `bin/codify.mjs` | autonomous codifier | HARD | hardens a flow into `tests/authored/<SPEC_NAME>.spec.ts`, runs it through the gate |
| `bin/interactive.mjs` | enforcing REPL | HARD | turn-by-turn drive → explore → harden over stdin |
| `extension/qa-focus/extension.mjs` | Copilot CLI extension | SOFT | the same tools inside your own `copilot` session (human-approval leash) |

All four compose the same building blocks; they differ only in surface setup, one-shot vs REPL, and
artifact handling — see [ADR 0002](adr/0002-extract-gated-session-harness.md).

## Core modules (`src/` + the gate)

| Module | Responsibility |
|--------|----------------|
| `src/harness.mjs` | **the control model** — `createGatedSession`: the one home for the hard leash (the only SDK import site besides the extension) |
| `extension/qa-focus/ladder.mjs` | **the gate** — `gradeLocator`/`render`/`buildLocator`: the locator-priority ladder, scoped tier, graceful degradation (incl. iframe/shadow/frameset) |
| `src/browser-tools.mjs` | the model's browser-action tools (snapshot/goto/click/fill/press/expect_visible/dismiss_consent/audit_a11y/save_auth/report_finding) |
| `src/codify-tools.mjs` | the codifier tools (propose_locator/write_spec/run_spec) |
| `src/provider.mjs` | `openSurface` — the web/Electron/OpenFin surface seam (+ `storageState`) |
| `src/pwcli.mjs` | thin gated wrapper over `@playwright/cli` + `attachCli` (action surface, no raw shell) |
| `src/allowlist.mjs` | URL allowlist predicate + `guardContext` network-layer nav guard |
| `src/evidence.mjs` | console/network/trace collection → ranked, deduped Markdown artifact |
| `src/standards.mjs` | deterministic Playwright-standards linter for authored specs + `STANDARDS_PROMPT` |
| `src/copilot-path.mjs` | portable resolution of the installed `copilot` binary |

## Primary data-flow path

**Explorer:** `openSurface` (provider) → `guardContext` (allowlist) + `attachCollectors` (evidence) →
`attachCli` (pwcli) → `createGatedSession` (harness) wires the gated `browser-tools` → the model acts
by element refs; every `expect_visible` is graded by **the gate** (ladder) → findings + anomalies →
`renderArtifact` → `artifacts/explore-report.md`.

**Codifier:** same setup with `browser-tools` + `codify-tools` → model walks the flow → `propose_locator`
(graded) → `write_spec` (linted by `standards`) → `run_spec` (real `playwright test`) → a durable spec
in `tests/authored/`.

## Architectural seams (where to be careful)

- **The leash** — `src/harness.mjs`. The prompt-injection defense; one definition. ([ADR 0002](adr/0002-extract-gated-session-harness.md))
- **The gate** — `ladder.mjs`. The locator-quality policy; the project's non-commodity value. ([ADR 0001](adr/0001-no-mcp-use-playwright-cli.md))
- **The surface** — `provider.mjs`. The only place a browser is launched (web/Electron/OpenFin).
- **The action surface** — `pwcli.mjs`. The only place the CLI is invoked (argv-discrete, no shell).

## Tests & fixtures

- `tests/` — deterministic, offline gate/ladder/standards/provider specs (run by `npm test`).
- `tests/live-complex.spec.ts` — opt-in live specs (`LIVE=1`).
- `tests/authored/` — codifier output; excluded from `npm test` unless `RUN_AUTHORED=1`.
- `fixtures/app/` — sample Todo app; `fixtures/complex/` — iframe/shadow/frameset surfaces.
