# Architecture Decision Records — qa-focus

One record per decision, MADR-lite (Context · Options · Decision · Consequences ·
Status). Files are `NNNN-kebab-title.md`, zero-padded, monotonic. Never edit an
accepted ADR's decision — supersede it (`Status: superseded-by-NNNN`).

**A new ADR isn't landed until this index has its row.**

| id | title | status |
|----|-------|--------|
| [0001](0001-no-mcp-use-playwright-cli.md) | No MCP — use the Playwright CLI model for browser actions | accepted |
| [0002](0002-extract-gated-session-harness.md) | Extract the gated-session control model into one seam | accepted |
| [0003](0003-distribution-native-adapters-no-mcp.md) | v1 distribution: CLI-first, native adapters, zero MCP | accepted (publish clause superseded-by-0006) |
| [0004](0004-typescript-core-and-npm-package.md) | Migrate the core to TypeScript and publish a typed npm package | accepted (publish clause superseded-by-0006) |
| [0005](0005-in-process-action-adapter-electron.md) | In-process action adapter for Electron (the CDP CLI can't attach) | accepted |
| [0006](0006-no-npm-publish-distribute-from-github.md) | No npm registry publish; distribute from the GitHub repo | accepted |
| [0007](0007-vscode-surface-chat-participant.md) | VS Code surface: an `@qa-focus` chat participant, not a tool or MCP | accepted |
| [0008](0008-streamable-repl-on-readline-not-ink.md) | The streamable REPL is built on Node `readline`, not Ink | accepted |
| [0009](0009-purpose-built-dom-snapshot-store-for-healing.md) | A purpose-built DOM snapshot store feeds the trace-driven healer, not the trace zip | accepted |
| [0010](0010-sandbox-run-spec-capability-scan-plus-scrubbed-env.md) | Isolate model-authored spec execution with a capability scan + a scrubbed environment | accepted |
