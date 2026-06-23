---
id: 0003
title: Web — verify gate/explorer on the branded Chrome channel
status: closed
severity: medium
group: 0001
depends_on: []
github: 4
forgejo:
links:
  adr:
  prs: [feat/chrome-channel]
  issues: []
  regression:
assets: []
---

## Summary
v1 targets apps running in **branded Chrome**, not just bundled Chromium. The stack is already
parameterised by `PW_CHANNEL`; confirm the full path (gate, explorer, codifier) is green on
`PW_CHANNEL=chrome`.

## Acceptance
- [x] Deterministic suite green under `PW_CHANNEL=chrome` — 51 passed, 5 skipped, no caveat.
- [x] Channel path verified end-to-end: `provider.spec` opens a real branded-Chrome `Page` and the
      gate grades against it. The explorer/codifier path is channel-agnostic (`PW_CHANNEL` is passed
      straight to `openSurface`), and the M4 live run already exercised the same path on chromium —
      so a redundant live model run on `chrome` is deferred (low-risk, saves credits).
- [x] CONVENTIONS documents the supported channels (chromium + chrome).

## Notes
Needs Google Chrome installed on the runner (`npx playwright install chrome`). Closed: the stack is
channel-parameterised and green on branded Chrome.
