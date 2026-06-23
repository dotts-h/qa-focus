---
id: 0008
title: GitHub Action adapter (explore/codify/gate in CI)
status: open
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
A composite/Docker GitHub Action wrapping the CLI so teams can run the explorer on a deploy preview,
codify a flow, or run the authored suite as a required check.

## Acceptance
- [ ] `action.yml` with inputs (mode, goal, start-url, channel, flow path).
- [ ] Example workflow; runs headless (xvfb where needed) on `ubuntu-latest`.
- [ ] Emits the artifact/flow + authored-spec result as job outputs.

## Notes
Wraps #0006. Web/Electron only in Linux CI; OpenFin needs Windows/macOS runners (#0002).
