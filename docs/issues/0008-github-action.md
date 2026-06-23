---
id: 0008
title: GitHub Action adapter (explore/codify/gate in CI)
status: closed
severity: medium
group: 0001
depends_on: [0006]
github: 9
forgejo:
links:
  adr: 0003
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
A composite GitHub Action wrapping the CLI so teams can run the explorer on a deploy preview, codify
a flow, or run the authored suite as a required check.

## Acceptance
- [x] `action.yml` (`.github/actions/qa-focus/`, composite) with inputs (mode, goal, url, channel,
      flow, spec, specs, model, allowlist, steps, copilot-token, ref) → mapped onto the harness env
      contract. Default `mode: gate` (the no-auth path).
- [x] Example workflow (`.github/workflows/qa-focus-example.yml`) — **manual-only** (`workflow_dispatch`,
      so it never auto-runs CI or spends a token), `ubuntu-latest`, headless (`playwright install
      --with-deps chromium`; no xvfb needed since we never run headed in CI).
- [x] Emits **artifact / flow / result** as job outputs (`run.sh` writes `$GITHUB_OUTPUT`).
      Smoke-verified locally: `mode: gate` ran the Playwright suite and emitted `result=pass`; an
      unknown mode exits 2. `tests/action.spec.ts` (5 cases) guards the manifest/outputs/no-MCP/example.

## Notes
Wraps #0006 (git-installed CLI; ADR 0006). **`gate` mode is the cleanly-CI-able path** — pure
Playwright, no model, no auth. `explore`/`codify` drive a model, so they need a Copilot login token in
CI (`copilot-token` input); that path needs a real Actions runner + token to verify end-to-end (not
done here). Web/Electron only on Linux runners; OpenFin needs Windows/macOS (#0002). **Zero MCP**
(ADR 0001/0003), guarded by the test. **Closes epic #0001** (last child).
