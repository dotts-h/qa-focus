# qa-focus

[![CI](https://github.com/dotts-h/qa-focus/actions/workflows/ci.yml/badge.svg)](https://github.com/dotts-h/qa-focus/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Control-first **agentic QA** on the GitHub Copilot SDK + Playwright. Two modes that chain:

- **Explore** (`bin/explore.mts`) — an autonomous browser agent roams an app toward a high-level
  goal, captures evidence (console/network anomalies + a Playwright trace), and reports findings a
  human verifies. *Discovery.*
- **Codify** (`bin/codify.mts`) — a hard-gated harness turns a discovered flow into a
  standards-compliant, durable Playwright spec under a deterministic gate. *Permanence.*

The thesis (proven before this repo existed): **agent reliability is a control problem, not a
prompting one.** The program owns the loop; the model fills narrow typed holes; a deterministic
gate verifies every step. Brittle-scripts-vs-autonomous is a false binary — the win is *structured*
autonomy with verification.

Both modes use the **installed `copilot` login** (no BYOK) via `RuntimeConnection.forStdio`, so they
run anywhere you're signed in, against any model your Copilot offers.

## Why it's safer than permissive autonomy

The explorer's defense against prompt injection (a malicious page telling the agent to read `.env`
and exfiltrate it) is **structural**: `availableTools` exposes only browser-action tools, so the
agent holds *no* filesystem/shell/network capability — the dangerous action has no tool to run.
A URL allowlist (`src/allowlist.mts`) is the second layer. Capability-gating + allowlist = belt and
suspenders.

## Layout

The core is **TypeScript** (`.mts`, strict; ADR 0004): `npm run build` emits ESM JS + `.d.mts`
types to `dist/`, dev runs straight from source via `tsx`.

```
extension/qa-focus/    installable Copilot CLI extension (interactive codifier) — ladder.mts + extension.mts
bin/explore.mts        autonomous explorer (discovery)
bin/codify.mts         autonomous codifier (flow → durable spec)
bin/interactive.mts    enforcing interactive REPL (drive → explore → harden)
src/index.mts          public package entry — the portable core, exported with types
src/harness.mts        the gated-session control model — one home for the leash (ADR 0002)
src/allowlist.mts      URL allowlist guard
src/evidence.mts       console/network/trace → Markdown artifact
fixtures/app/          self-contained sample app (used by tests)
tests/                 deterministic gate + allowlist specs (green)
docs/ARCHITECTURE.md   explorer↔codifier, the Antigravity-pillar mapping, security model
```

## Quickstart

```bash
npm i && npx playwright install chromium
PW_CHANNEL=chromium npm test            # deterministic gate + allowlist proofs (no model)
npm run typecheck                       # strict tsc --noEmit; `npm run build` → dist/ (JS + .d.mts)

GOAL="log in and add a task" npm run explore   # live explorer → artifacts/explore-report.md
GOAL="harden the add-to-cart flow" SPEC_NAME="add-to-cart" npm run codify   # live codifier → tests/authored/
```

## CLI

Installed, `qa-focus` drives any app through one entrypoint — it embeds `@github/copilot-sdk` and
uses your installed `copilot` login (no API key, no MCP). It installs **straight from the GitHub
repo** — there is no npm-registry package ([ADR 0006](docs/adr/0006-no-npm-publish-distribute-from-github.md));
a git install runs the `prepare` build to compile `dist/`:

```bash
npm i -g github:dotts-h/qa-focus    # or run ad-hoc: npx github:dotts-h/qa-focus <command>
npx playwright install chromium

qa-focus explore     --goal "Add a task and verify it appears" --url https://your.app
qa-focus codify      --flow artifacts/explore-flow.json --spec add-task
qa-focus interactive --url https://your.app     # enforcing REPL (the hard leash)
qa-focus models                                 # list the models your login can use
qa-focus --help
```

**Model selection & headless runs.** `qa-focus models` (alias `--list-models`) prints the model ids
your `copilot` login exposes; pass one with `--model <id>` (an unknown id fails loud with the valid
set — never a silent fallback). `--quiet` silences the live stream for headless/piped/CI runs, leaving
the evidence artifact, the durable flow, and a token + AI-Credits cost summary as the machine-readable
output:

```bash
qa-focus explore --model claude-haiku-4.5 --quiet --url https://your.app --goal "…"
```

Friendly flags map onto the env contract the harnesses read
(`GOAL`/`START_URL`/`PW_CHANNEL`/`SURFACE`/`FLOW`/`STORAGE_STATE`/`COPILOT_MODEL`/`QA_QUIET`/…); a
value flag with no value exits non-zero rather than silently using a wrong default. `qa-focus --help`
lists them all.

## GitHub Copilot CLI plugin

qa-focus also ships as a native **Copilot CLI plugin** — a `qa-focus` skill that teaches the Copilot
CLI agent when and how to drive the CLI above (explore / codify / the locator gate). It's distributed
from the **git marketplace** (`plugins/qa-focus/plugin.json` + `.github/plugin/marketplace.json`),
**bundles no MCP server** ([ADR 0003](docs/adr/0003-distribution-native-adapters-no-mcp.md)):

```bash
copilot plugin marketplace add dotts-h/qa-focus     # registers this repo as a marketplace
copilot plugin install qa-focus@qa-focus            # installs the qa-focus skill
```

(The CLI itself still installs from git — see above; the plugin's skill drives it.)

## GitHub Action (CI)

A composite action (`.github/actions/qa-focus`) wraps the CLI for CI. `mode: gate` runs the durable,
gate-graded Playwright suite as a **required check** — pure Playwright, **no model, no token**, so it
runs anywhere. `mode: explore | codify` drive a model and need a Copilot login token. Web/Electron on
Linux runners (OpenFin needs win/mac). See `.github/workflows/qa-focus-example.yml` (manual-only).

```yaml
- uses: dotts-h/qa-focus/.github/actions/qa-focus@main
  id: qa
  with:
    mode: gate          # or: explore / codify (+ copilot-token, url, goal, …)
# steps.qa.outputs → result, and artifact / flow (explore)
```

## Status

- **Proven:** the locator-priority gate (ladder + scoped tier + graceful degradation, incl. iframes,
  open/closed shadow DOM, and legacy `<frameset>`) on clean, hostile, and real big apps; the URL
  allowlist; the autonomous **explorer** (live, against automationexercise.com / the-internet); the
  autonomous **codifier** end-to-end (discovered flow → durable, gate-clean, passing Playwright spec).
- **Also in:** deterministic axe-core a11y pass, `storageState` auth reuse, consent-banner handling,
  and the gated-session control model in one seam (`src/harness.mts`, ADR 0002).

See `docs/ARCHITECTURE.md`.

## License

[Apache-2.0](LICENSE). Patent grant included.
