#!/usr/bin/env bash
# qa-focus action dispatch (#0008). Reads QA_MODE + the harness env contract (GOAL/START_URL/…,
# set by action.yml) and runs the chosen mode, writing job outputs to $GITHUB_OUTPUT.
#   gate    — run the authored Playwright suite as a required check (NO model, NO auth). Default.
#   explore — drive the autonomous explorer (needs a Copilot login / token).
#   codify  — harden a flow into a gated spec (needs a Copilot login / token).
# Zero MCP (ADR 0001/0003).
set -euo pipefail

mode="${QA_MODE:-gate}"
out="${GITHUB_OUTPUT:-/dev/stdout}"
emit() { printf '%s=%s\n' "$1" "$2" >> "$out"; }

# explore/codify drive a model through the installed copilot login. In CI, surface the provided
# token to the env the login reads. gate needs none of this.
if [ -n "${COPILOT_TOKEN:-}" ]; then export GH_TOKEN="$COPILOT_TOKEN" GITHUB_TOKEN="$COPILOT_TOKEN"; fi

case "$mode" in
  gate)
    # The non-commodity value as a required check: run the durable, gate-graded specs. Pure
    # Playwright — no model, no quota — so it runs cleanly on any runner.
    if npx --yes playwright test ${QA_SPECS:-}; then emit result pass; else emit result fail; exit 1; fi
    ;;
  explore)
    qa-focus explore --quiet
    art="$(pwd)/artifacts/explore-report.md"
    flow="$(pwd)/artifacts/explore-flow.json"
    emit artifact "$art"
    emit flow "$flow"
    emit result "$([ -f "$flow" ] && echo pass || echo fail)"
    ;;
  codify)
    qa-focus codify --quiet
    emit result pass
    ;;
  *)
    echo "qa-focus action: unknown mode '$mode' (expected gate | explore | codify)" >&2
    exit 2
    ;;
esac
