---
id: 0007
title: Copilot CLI plugin packaging (plugin.json + git marketplace)
status: open
severity: medium
group: 0001
depends_on: [0006]
github: 8
forgejo:
links:
  adr: 0003
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
Package the interactive extension as a native Copilot CLI **plugin** (`plugin.json`) distributable
via the git-based marketplace (`copilot plugin marketplace add OWNER/REPO`; `copilot plugin install`).

## Acceptance
- [ ] `plugin.json` manifest; the extension loads as an installed plugin (not just a project shim).
- [ ] Install-from-git documented; verified end-to-end in a `copilot --experimental` session.
- [ ] **No MCP server bundled** (the format permits one — we don't use it; ADR 0003).

## Notes
Distinct from the npm CLI (#0006): this is the interactive-in-Copilot surface.
