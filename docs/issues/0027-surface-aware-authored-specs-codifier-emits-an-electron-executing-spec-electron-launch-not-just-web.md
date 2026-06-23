---
id: 0027
title: Surface-aware authored specs — codifier emits an Electron-executing spec (_electron.launch), not just web
status: closed
severity: medium
group: 0025
depends_on: [0026]
github:
forgejo:
links:
  adr: [0005, 0011]
  prs: []
  issues: [0026]
  regression:
assets: [0027-electron-executing-spec.ts]
---

> **Done 2026-06-23 (ADR 0011).** The codifier is now surface-aware: a `SURFACE=electron` run authored
> an `_electron.launch` spec that passed `run_spec` (3/3) against the real Electron app, live under
> `xvfb` — evidence `assets/0027-electron-executing-spec.ts`.

## Outcome
- **`specShapeInstruction(surface, {appPath})`** (`src/standards.mts`) is the single home for the
  surface-specific spec shape; the codify prompt injects it by `SURFACE`. Electron → `_electron.launch`
  in `beforeAll`, first window bound to `page` (so gate-accepted `page.getByRole(...)` reuse verbatim),
  no `goto`; web/openfin → the URL-navigated shape unchanged.
- **App path**: `QA_ELECTRON_APP` added to the `safeSpecEnv` allowlist (a path, not a secret); the
  template reads it with the codifier-supplied path baked as a literal fallback (portable + standalone).
- **Codifier `electronArgs` fix**: `bin/codify.mts` now passes `electronArgs` to `openSurface` (it
  didn't before — so `SURFACE=electron` codify never actually drove the Electron app) and seeds
  `QA_ELECTRON_APP` from them.
- **Gates unchanged**: the standards linter + capability scan already accept the Electron shape
  (`@playwright/test`/`playwright` imports are not host-capability modules) — proven by the guard.

## Acceptance
- [x] `SURFACE=electron` codify run authors an `_electron.launch`-based spec (not `page.goto`) —
      live-verified, 3/3 green on the real Electron app (`assets/0027-electron-executing-spec.ts`).
- [x] `run_spec` runs it green on Electron under `xvfb`; web specs unaffected (189 deterministic green).
- [x] Standards/capability gates pass the Electron template; deterministic guard
      `tests/authored-spec-shape.spec.ts` (5 tests) covers the shape + both gates + the env allowlist.

## Notes
The worked example is captured as **evidence** (`assets/0027-electron-executing-spec.ts`), not
committed under `tests/authored/`: an Electron-executing spec needs the `electron` binary + a display,
which CI deliberately lacks (electron is opt-in — `fixtures/electron/README.md`), so committing it
would make `RUN_AUTHORED` require electron everywhere. The canonical shape is committed *inside* the
deterministic guard (`ELECTRON_SPEC`), which proves it clears both gates without needing the binary.
Closes epic #0025 (last loop-completion gap). See ADR 0011.

## Summary
Surfaced by #0026's live Electron loop. The codifier authors a **web-shaped** spec — `test(..., async ({
page }) => { await page.goto(url); … })` — *regardless of `SURFACE`*. On Electron the discovered
role+name locators were gate-validated against the live Electron window during authoring (the
durability thesis holds: Electron windows are Pages with identical accessibility), but the spec the
codifier *writes* uses the default `{ page }` web fixture + `page.goto`, so `run_spec` executes it
against the **web** server, not Electron. The authored-spec template + `run_spec` are not
surface-aware.

To make the durable artifact actually exercise the surface it was discovered on, the codifier needs an
**Electron-executing spec template**: a spec that does `_electron.launch({ args: [appDir] })` in a
`test.beforeAll`/fixture, drives `electronApp.firstWindow()`, and asserts the same gate-clean
role+name locators — plus a `run_spec` path that runs it (the standards linter + capability scan
still apply).

## What "done" looks like
- The codifier, when `SURFACE=electron`, authors a spec that **launches Electron** (`_electron.launch`)
  and runs the flow against the real Electron window — not a `page.goto` web spec.
- `run_spec` executes that Electron spec (under `xvfb` on Linux) and it passes on `fixtures/electron/`.
- The standards linter (`src/standards.mts`) and capability scan (`src/spec-guard.mts`) accept the
  Electron template (or are extended for it) — no `_electron` import is wrongly flagged as dangerous.
- A worked example committed under `tests/authored/` (RUN_AUTHORED-gated), with a deterministic guard.

## Acceptance
- [ ] `SURFACE=electron` codify run authors an `_electron.launch`-based spec (not `page.goto`).
- [ ] `run_spec` runs it green on Electron under `xvfb`; web specs unaffected.
- [ ] Standards/capability gates pass the Electron template; a deterministic guard covers it.

## Notes
Seams: the authored-spec template the codifier writes (in `src/codify-tools.mts` / the codify prompt),
`run_spec` (`src/spec-guard.mts` exec path + env), and `src/standards.mts` (don't reject the legit
`_electron`/`playwright` import). Depends on #0026 (the in-process explore→codify loop is verified on
Electron; this hardens the *output* to run there too). This is the last loop-completion gap; after it
the epic #0025 is done and the next move is a product call on a new pillar.
