---
id: 0006
title: Standalone CLI npm package (qa-focus explore|codify|interactive)
status: open
severity: high
group: 0001
depends_on: [0005]
github: 7
forgejo:
links:
  adr: 0003
  prs: []
  issues: [0007, 0008]
  regression:
assets: []
---

## Summary
Publish the autonomous harnesses as an installable CLI — `qa-focus <explore|codify|interactive>` —
embedding `@github/copilot-sdk` directly (the SDK is standalone; no `copilot` binary required to
build an agent). The **primary v1 deliverable**.

## Acceptance
- [ ] `package.json` `bin` entries; a single `qa-focus` entrypoint with subcommands + `--help`.
- [ ] Published to npm (typed, from #0005); `npx qa-focus explore` works from a clean install.
- [ ] README quickstart; respects existing env contract (GOAL/START_URL/PW_CHANNEL/FLOW/...).

## Notes
No MCP (ADR 0003). Wraps `bin/explore.mjs`/`codify.mjs`/`interactive.mjs` behind one CLI.
