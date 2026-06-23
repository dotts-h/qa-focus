---
id: 0017
title: Headless run mode + model selection (--model / --list-models)
status: open
severity: medium
group: 0015
depends_on: []
github:
forgejo:
links:
  adr: 0003
  prs: []
  issues: [0015]
  regression:
assets: []
---

## Summary
Let an operator **choose the Copilot model** and run **headless/one-shot** from the shell. The SDK
already exposes `client.listModels(): ModelInfo[]` and `createSession({ model })`, and the harness
takes a `model` option — surface them as first-class CLI flags so a run is reproducible and
CI/pipe-friendly.

## Acceptance
- [ ] `qa-focus --list-models` prints the available models (id + name, and a flag for the default)
      from `client.listModels()` — no run, just the list. Exits 0.
- [ ] `--model <id>` selects the session model on `explore`/`codify`/`interactive` (validated against
      the list; an unknown id fails loud with the valid set, not a silent fallback).
- [ ] Headless one-shot: `explore`/`codify` already run non-interactively; ensure `--quiet`/`QA_QUIET`
      gives clean machine-readable output (stream off, final artifact/flow + the cost summary only) so
      a CI/pipe consumer gets a stable result. Document the headless invocation.
- [ ] A **pure** unit test for the model-resolution logic (given a model list + a requested id →
      resolved id or a typed error; no network/model).

## Notes
`COPILOT_MODEL` env already feeds the harness; `--model` is the friendly flag onto it (consistent
with the flag→env contract, ADR 0003). `listModels()` returns `ModelInfo` (`node_modules/@github/
copilot-sdk` — verify the exact fields when building). Cost accounting (#0014) already prints per-model
usage, which pairs naturally with model selection.
