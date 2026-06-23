# Architecture Decision Records — qa-focus

One record per decision, MADR-lite (Context · Options · Decision · Consequences ·
Status). Files are `NNNN-kebab-title.md`, zero-padded, monotonic. Never edit an
accepted ADR's decision — supersede it (`Status: superseded-by-NNNN`).

**A new ADR isn't landed until this index has its row.**

| id | title | status |
|----|-------|--------|
| [0001](0001-no-mcp-use-playwright-cli.md) | No MCP — use the Playwright CLI model for browser actions | accepted |
| [0002](0002-extract-gated-session-harness.md) | Extract the gated-session control model into one seam | accepted |
| [0003](0003-distribution-native-adapters-no-mcp.md) | v1 distribution: CLI-first, native adapters, zero MCP | accepted |
| [0004](0004-typescript-core-and-npm-package.md) | Migrate the core to TypeScript and publish a typed npm package | accepted |
