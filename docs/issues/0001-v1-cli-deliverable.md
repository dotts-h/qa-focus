---
id: 0001
title: "Epic: v1 — CLI deliverable across web(chrome)+electron+openfin, no MCP"
status: open
severity: high
group:
depends_on: []
github: 2
forgejo:
links:
  adr: 0003
  prs: []
  issues: [0002, 0003, 0004, 0005, 0006, 0007, 0008]
  regression:
assets: []
---

## Summary
Bring qa-focus to a v1 **CLI/CI deliverable** — **no MCP, no IDE embedding** (ADR 0003), a typed
package (ADR 0004) — whose gate + explorer + codifier are live-verified on **web (Chrome channel),
Electron, and OpenFin**, and which installs as CLI tools.

## Acceptance
- [ ] Surfaces live-verified: web `PW_CHANNEL=chrome` (#0003), Electron explorer path (#0004), OpenFin (#0002).
- [ ] Core is TypeScript + typed npm package (#0005); standalone `qa-focus` CLI published (#0006).
- [ ] Copilot CLI plugin (#0007) and GitHub Action (#0008) ship.
- [ ] Zero MCP anywhere (ADR 0003); PLAN "v1 definition" boxes all ticked.

## Notes
Decision context in ADR 0003 (CLI-first, zero MCP) + ADR 0004 (TypeScript/npm). Trust loose ends
(#0009 red-team, #0010 trace-healing) and the #0011 flake are tracked but not v1 blockers.
