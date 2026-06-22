# qa-focus

Control-first **agentic QA** on the GitHub Copilot SDK + Playwright. Two modes that chain:

- **Explore** (`bin/explore.mjs`) — an autonomous browser agent roams an app toward a high-level
  goal, captures evidence (console/network anomalies + a Playwright trace), and reports findings a
  human verifies. *Discovery.*
- **Author / codify** (`bin/author.mjs`) — a hard-gated harness turns a flow into a
  standards-compliant, durable Playwright locator/test under a deterministic gate. *Permanence.*

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
extension/qa-focus/    installable Copilot CLI extension (always-on codifier) — ladder.mjs + extension.mjs
bin/author.mjs         hard-gated authoring harness (codifier)
bin/explore.mjs        autonomous explorer (first cut)
src/allowlist.mjs      URL allowlist guard
src/evidence.mjs       console/network/trace → Markdown artifact
fixtures/app/          self-contained sample app (used by tests)
tests/                 deterministic gate + allowlist specs (13, green)
docs/ARCHITECTURE.md   explorer↔codifier, the Antigravity-pillar mapping, security model
```

## Quickstart

```bash
npm i && npx playwright install chromium
PW_CHANNEL=chromium npm test            # deterministic gate + allowlist proofs (no model)

node bin/author.mjs                      # live codifier (uses your installed copilot login)
GOAL="log in and add a task" node bin/explore.mjs   # live explorer → artifacts/explore-report.md
```

## Status

- **Proven:** the locator-priority gate (ladder + scoped tier + graceful degradation) on a clean app
  and a real hostile one; the URL allowlist; the codifier end-to-end on the installed login.
- **First cut, not yet live-verified:** `bin/explore.mjs` (autonomous explorer) and
  `extension/qa-focus/extension.mjs` (interactive install) — unit-tested parts pass; a live
  interactive/explore smoke is the next step.

See `docs/ARCHITECTURE.md`.
