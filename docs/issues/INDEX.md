# Issues index — qa-focus

Source of truth for tracked work. Markdown files here are canonical; mirror to
GitHub via `scripts/sync-github.sh` (requires `gh`). File new issues with
`scripts/new-issue.sh "<title>" [--epic] [--group <id>] [--severity <s>] [--depends id,id]`
— it appends the row here. Format reference: [TEMPLATE.md](TEMPLATE.md).

> **Don't put `|` in a title.** `next-issue.sh` splits each table row on `|`, so a pipe in the
> title column (even escaped `\|`) shifts every later column — the status is misread and the item's
> `depends_on` blockers resolve wrong. Use `/` or `,` instead (e.g. `explore / codify / interactive`).

Epics group children via the `group:` field; an epic may live in the Epics table
or as an `Epic:`-titled row in the Issues table — pickers handle both. Hard
ordering lives in each issue's `depends_on:` frontmatter (real blockers only,
never a cycle).

## Epics

| id | title | status | children |
|----|-------|--------|----------|
| [0001](0001-v1-cli-deliverable.md) | v1 — CLI deliverable across web(chrome)+electron+openfin, no MCP | closed | 0002–0008 |
| [0015](0015-epic-multi-host-runner-streamable-repl-headless-model-select-vs-code-participant.md) | Multi-host runner — streamable REPL, headless model-select, VS Code participant | closed | 0016–0018 |

## Issues

| id | title | status | severity | group | links |
|----|-------|--------|----------|-------|-------|
| [0002](0002-openfin-live-verify.md) | OpenFin live-verify (RVM remote-debug + connectOverCDP) | closed | high | 0001 | adr:0003 |
| [0003](0003-web-chrome-channel.md) | Web — verify gate/explorer on the branded Chrome channel | closed | medium | 0001 | — |
| [0004](0004-electron-explorer-path.md) | Electron — explorer/codifier in-process action path | closed | medium | 0001 | adr:0001,0005 |
| [0005](0005-typescript-core-npm.md) | Migrate core to TypeScript + publish typed npm package | closed | high | 0001 | adr:0004 |
| [0006](0006-standalone-cli-npm.md) | Standalone CLI — git-distributed (explore / codify / interactive) | closed | high | 0001 | adr:0003,0006; dep:0005 |
| [0007](0007-copilot-cli-plugin.md) | Copilot CLI plugin packaging (plugin.json + git marketplace) | closed | medium | 0001 | adr:0003; dep:0006 |
| [0008](0008-github-action.md) | GitHub Action adapter (explore/codify/gate in CI) | closed | medium | 0001 | adr:0003; dep:0006 |
| [0009](0009-live-injection-redteam.md) | Live adversarial prompt-injection red-team | closed | medium | — | adr:0001 |
| [0010](0010-trace-driven-healing.md) | M5 trace-driven self-healing | closed | low | — | — |
| [0011](0011-frameset-flake.md) | Flaky legacy &lt;frameset&gt; degradation test under parallel load | closed | low | — | — |
| [0012](0012-epic-observable-runs-live-thinking-output-stream-cost-accounting.md) | Epic: Observable runs — live thinking/output stream + cost accounting | closed | medium | — | |
| [0013](0013-live-run-stream-reasoning-assistant-deltas-tool-events.md) | Live run stream (reasoning + assistant deltas + tool events) | closed | medium | 0012 | |
| [0014](0014-cost-usage-accounting-tokens-ai-credits-on-direct-shell-runs.md) | Cost & usage accounting (tokens + AI-Credits, on direct shell runs) | closed | medium | 0012 | |
| [0015](0015-epic-multi-host-runner-streamable-repl-headless-model-select-vs-code-participant.md) | Epic: Multi-host runner — streamable REPL, headless model-select, VS Code participant | closed | medium | — | |
| [0016](0016-streamable-repl-polish-readline-stream-while-typing-adr-0008.md) | Streamable REPL polish — readline stream-while-typing (ADR 0008) | closed | medium | 0015 | |
| [0017](0017-headless-run-mode-model-selection-model-list-models.md) | Headless run mode + model selection (--model / --list-models) | closed | medium | 0015 | |
| [0018](0018-vs-code-qa-focus-chat-participant-extension-adr-0007-no-mcp.md) | VS Code @qa-focus chat participant extension (ADR 0007, no MCP) | closed | medium | 0015 | adr:0007 |
| [0019](0019-epic-v1-1-close-the-deferred-remainders.md) | Epic: v1.1 — close the deferred remainders | closed | medium | — | prs:45-49 |
| [0020](0020-trace-driven-healer-integration-feed-explore-trace-zip-dom-into-the-recover-re-grade-core.md) | Trace-driven healer integration — feed explore-trace.zip DOM into the recover+re-grade core | closed | medium | 0019 | adr:0009 |
| [0021](0021-nested-multi-level-iframe-inline-frameset-gate-coverage.md) | Nested/multi-level iframe + inline frameset gate coverage | closed | medium | 0019 | |
| [0022](0022-sandbox-run-spec-isolate-model-authored-spec-execution.md) | Sandbox run_spec — isolate model-authored spec execution | closed | high | 0019 | adr:0010 |
| [0023](0023-live-model-driven-prompt-injection-red-team-on-a-hostile-fixture-page.md) | Live model-driven prompt-injection red-team on a hostile fixture page | closed | high | 0019 | |
| [0024](0024-openfin-live-rvm-verify-connectovercdp-on-real-runtime.md) | OpenFin live RVM verify (connectOverCDP on real runtime) | closed | medium | 0019 | regression:4 |
| [0025](0025-epic-live-verify-the-autonomous-loop-end-to-end-across-surfaces.md) | Epic: live-verify the autonomous loop end-to-end across surfaces | open | medium | — | |
| [0026](0026-live-autonomous-explore-to-codify-run-on-a-real-electron-window-in-process-driver-xvfb.md) | Live autonomous explore to codify run on a real Electron window (in-process driver, xvfb) | closed | medium | 0025 | adr:0005; regression:5; issues:0027 |
| [0027](0027-surface-aware-authored-specs-codifier-emits-an-electron-executing-spec-electron-launch-not-just-web.md) | Surface-aware authored specs — codifier emits an Electron-executing spec (_electron.launch), not just web | open | medium | 0025 | |
