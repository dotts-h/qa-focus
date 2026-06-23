# qa-focus

[![CI](https://github.com/dotts-h/qa-focus/actions/workflows/ci.yml/badge.svg)](https://github.com/dotts-h/qa-focus/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Control-first **agentic QA** on the GitHub Copilot SDK + Playwright. Two modes that chain:

- **Explore** (`bin/explore.mjs`) — an autonomous browser agent roams an app toward a high-level
  goal, captures evidence (console/network anomalies + a Playwright trace), and reports findings a
  human verifies. *Discovery.*
- **Codify** (`bin/codify.mjs`) — a hard-gated harness turns a discovered flow into a
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
A URL allowlist (`src/allowlist.mjs`) is the second layer. Capability-gating + allowlist = belt and
suspenders.

## Layout

```
extension/qa-focus/    installable Copilot CLI extension (interactive codifier) — ladder.mjs + extension.mjs
bin/explore.mjs        autonomous explorer (discovery)
bin/codify.mjs         autonomous codifier (flow → durable spec)
bin/interactive.mjs    enforcing interactive REPL (drive → explore → harden)
src/harness.mjs        the gated-session control model — one home for the leash (ADR 0002)
src/allowlist.mjs      URL allowlist guard
src/evidence.mjs       console/network/trace → Markdown artifact
fixtures/app/          self-contained sample app (used by tests)
tests/                 deterministic gate + allowlist specs (green)
docs/ARCHITECTURE.md   explorer↔codifier, the Antigravity-pillar mapping, security model
```

## Quickstart

```bash
npm i && npx playwright install chromium
PW_CHANNEL=chromium npm test            # deterministic gate + allowlist proofs (no model)

GOAL="log in and add a task" node bin/explore.mjs   # live explorer → artifacts/explore-report.md
GOAL="harden the add-to-cart flow" SPEC_NAME="add-to-cart" node bin/codify.mjs   # live codifier → tests/authored/
```

## Status

- **Proven:** the locator-priority gate (ladder + scoped tier + graceful degradation, incl. iframes,
  open/closed shadow DOM, and legacy `<frameset>`) on clean, hostile, and real big apps; the URL
  allowlist; the autonomous **explorer** (live, against automationexercise.com / the-internet); the
  autonomous **codifier** end-to-end (discovered flow → durable, gate-clean, passing Playwright spec).
- **Also in:** deterministic axe-core a11y pass, `storageState` auth reuse, consent-banner handling,
  and the gated-session control model in one seam (`src/harness.mjs`, ADR 0002).

See `docs/ARCHITECTURE.md`.

## License

[Apache-2.0](LICENSE). Patent grant included.
