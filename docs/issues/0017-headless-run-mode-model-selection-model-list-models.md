---
id: 0017
title: Headless run mode + model selection (--model / --list-models)
status: closed
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
- [x] `qa-focus models` (alias `--list-models`) prints the available models (id + name) from
      `client.listModels()` — no run, just the list, exit 0. `src/models.mts` (`listCopilotModels` +
      pure `formatModelList`) + `bin/models.mts`. Verified live (14 models listed). The SDK `ModelInfo`
      carries no default flag, so the default is documented as "omit `--model`" rather than marked.
- [x] `--model <id>` selects the session model (already mapped → `COPILOT_MODEL`) and is **validated
      in the harness** against `client.listModels()` before the session opens — an unknown id throws
      with the valid set, not a silent fallback. Verified live: `--model bogus-model` → fails loud,
      exit 1, no quota burned; `--model claude-haiku-4.5` → ran and the cost summary confirms the model.
- [x] Headless one-shot: `--quiet` (mapped → `QA_QUIET`) silences the stream; the artifact + durable
      flow + token/AI-Credits cost summary are the machine-readable output. Verified live; README
      documents the headless invocation.
- [x] A **pure** unit test for model resolution (`tests/models.spec.ts`, 7 cases: exact match, unset
      default, fail-loud-on-unknown listing the set, case/whitespace exactness, empty list) + CLI
      wiring tests (`models` command parses; `--help` lists it).

## Notes
`COPILOT_MODEL` env already feeds the harness; `--model` is the friendly flag onto it (consistent
with the flag→env contract, ADR 0003). `listModels()` returns `ModelInfo` (`node_modules/@github/
copilot-sdk` — verify the exact fields when building). Cost accounting (#0014) already prints per-model
usage, which pairs naturally with model selection.
