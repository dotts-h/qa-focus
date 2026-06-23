---
id: 0003
title: Web — verify gate/explorer on the branded Chrome channel
status: open
severity: medium
group: 0001
depends_on: []
github: 4
forgejo:
links:
  adr:
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
v1 targets apps running in **branded Chrome**, not just bundled Chromium. The stack is already
parameterised by `PW_CHANNEL`; confirm the full path (gate, explorer, codifier) is green on
`PW_CHANNEL=chrome`.

## Acceptance
- [ ] Deterministic suite green under `PW_CHANNEL=chrome` (document any channel-specific caveat).
- [ ] One live explore/codify run on `chrome` channel.
- [ ] CONVENTIONS/PLAN note the supported channels.

## Notes
Needs Google Chrome installed on the runner (`npx playwright install chrome`).
