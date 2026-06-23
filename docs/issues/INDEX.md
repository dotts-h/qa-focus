# Issues index — qa-focus

Source of truth for tracked work. Markdown files here are canonical; mirror to
GitHub via `scripts/sync-github.sh` (requires `gh`). File new issues with
`scripts/new-issue.sh "<title>" [--epic] [--group <id>] [--severity <s>] [--depends id,id]`
— it appends the row here. Format reference: [TEMPLATE.md](TEMPLATE.md).

Epics group children via the `group:` field; an epic may live in the Epics table
or as an `Epic:`-titled row in the Issues table — pickers handle both. Hard
ordering lives in each issue's `depends_on:` frontmatter (real blockers only,
never a cycle).

## Epics

| id | title | status | children |
|----|-------|--------|----------|
| [0001](0001-v1-cli-deliverable.md) | v1 — CLI deliverable across web(chrome)+electron+openfin, no MCP | open | 0002–0008 |

## Issues

| id | title | status | severity | group | links |
|----|-------|--------|----------|-------|-------|
| [0002](0002-openfin-live-verify.md) | OpenFin live-verify (RVM remote-debug + connectOverCDP) | closed | high | 0001 | adr:0003 |
| [0003](0003-web-chrome-channel.md) | Web — verify gate/explorer on the branded Chrome channel | closed | medium | 0001 | — |
| [0004](0004-electron-explorer-path.md) | Electron — explorer/codifier in-process action path | closed | medium | 0001 | adr:0001,0005 |
| [0005](0005-typescript-core-npm.md) | Migrate core to TypeScript + publish typed npm package | closed | high | 0001 | adr:0004 |
| [0006](0006-standalone-cli-npm.md) | Standalone CLI npm package (qa-focus explore\|codify\|interactive) | in-progress | high | 0001 | adr:0003; dep:0005 |
| [0007](0007-copilot-cli-plugin.md) | Copilot CLI plugin packaging (plugin.json + git marketplace) | open | medium | 0001 | adr:0003; dep:0006 |
| [0008](0008-github-action.md) | GitHub Action adapter (explore/codify/gate in CI) | open | medium | 0001 | adr:0003; dep:0006 |
| [0009](0009-live-injection-redteam.md) | Live adversarial prompt-injection red-team | open | medium | — | adr:0001 |
| [0010](0010-trace-driven-healing.md) | M5 trace-driven self-healing | open | low | — | — |
| [0011](0011-frameset-flake.md) | Flaky legacy &lt;frameset&gt; degradation test under parallel load | closed | low | — | — |
| [0012](0012-epic-observable-runs-live-thinking-output-stream-cost-accounting.md) | Epic: Observable runs — live thinking/output stream + cost accounting | closed | medium | — | |
| [0013](0013-live-run-stream-reasoning-assistant-deltas-tool-events.md) | Live run stream (reasoning + assistant deltas + tool events) | closed | medium | 0012 | |
| [0014](0014-cost-usage-accounting-tokens-ai-credits-on-direct-shell-runs.md) | Cost & usage accounting (tokens + AI-Credits, on direct shell runs) | closed | medium | 0012 | |
