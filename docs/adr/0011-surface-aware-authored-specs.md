# ADR 0011 — Surface-aware authored specs (Electron-executing, not just web)

- Status: accepted
- Date: 2026-06-23

## Context

The codifier hardens a discovered flow into a durable Playwright test: the model walks the live
surface, gate-grades each locator via `propose_locator`, then `write_spec` writes the `.spec.ts` and
`run_spec` executes it. Until now the prompt instructed *one* spec shape regardless of surface — a
web spec: `import { test, expect } from '@playwright/test'`, `await page.goto(url)`, assert on the
default `{ page }` fixture.

The live Electron explore→codify run (#0026) exposed the gap: codifying an **Electron** flow still
produced a `page.goto` web spec. The discovered role+name locators are identical across surfaces
(Electron windows *are* Playwright `Page`s with the same accessibility tree), so they were validated
against the live Electron window during authoring — but the artifact `run_spec` executed ran against
**web**, not the Electron app. A durable test for an Electron target should *launch and assert on the
Electron app*. Electron exposes no CDP endpoint, so there is no URL to navigate and no fixture to
attach: the spec itself must own the app lifecycle.

Two sub-problems: (1) the spec must `_electron.launch` the app in a `beforeAll`; (2) it must know
*which* app to launch, portably, without baking a machine-specific absolute path.

## Options

1. **Leave authored specs web-only.** Simplest, but the "surface-agnostic" thesis (CONTEXT.md) then
   stops at the gate — the *durable output* never exercises Electron. Rejected: it under-delivers the
   stated differentiator.
2. **A separate Electron test template file the codifier copies.** A fixed template per surface.
   Rigid — the model can't adapt assertions/structure to the flow, and it duplicates the spec shape
   outside the prompt. Rejected.
3. **Surface-aware prompt instruction (chosen).** A pure `specShapeInstruction(surface, {appPath})`
   (`src/standards.mts`) returns the shape guidance the codify prompt injects: the web/openfin shape
   (URL-navigated) or the Electron shape (`_electron.launch` in `beforeAll`, bind the first window to
   a variable named `page` so the gate-accepted `page.getByRole(...)` expressions are reused
   verbatim, no `goto`). The app path comes from `process.env.QA_ELECTRON_APP` (allowlisted through
   `safeSpecEnv`, ADR 0010) with the codifier-supplied path baked as a literal fallback — so the spec
   is portable yet self-contained.

## Decision

Option 3. `specShapeInstruction` is the single home for the surface-specific spec shape; the codifier
selects it by `SURFACE`. The existing gates are unchanged and already accept the Electron shape: the
standards linter (`src/standards.mts`) has nothing to flag (web-first assertions, no `goto`, no hard
waits), and the capability scan (`src/spec-guard.mts`) allows `@playwright/test` / `playwright`
imports (`_electron` lives there) — only host-capability modules are rejected. `QA_ELECTRON_APP` is
added to the `safeSpecEnv` allowlist as an operational *path* (like `STORAGE_STATE`), not a secret.
The codifier also now passes `electronArgs` to `openSurface` (it previously didn't, so `SURFACE=
electron` codify never drove the real app) and seeds `QA_ELECTRON_APP` from those args.

## Consequences

- **+** The durable artifact now *executes on the surface it was discovered on*: a `SURFACE=electron`
  codify run authors an `_electron.launch` spec that `run_spec` runs against the real Electron app —
  live-verified end-to-end (#0027, evidence `docs/issues/assets/0027-electron-executing-spec.ts`).
- **+** The locator-durability thesis is preserved: role+name expressions are reused verbatim because
  the launched window is bound to `page`.
- **+** No new gate logic and no new infrastructure — a prompt-shape function + one env-allowlist
  entry. Web/openfin authoring is unchanged.
- **−** An Electron-executing spec needs the `electron` binary + a display (xvfb on Linux), so it
  cannot run in the default CI (`electron` is deliberately not a committed dependency — see
  `fixtures/electron/README.md`). The committed coverage is therefore the **deterministic guard**
  (`tests/authored-spec-shape.spec.ts`, which embeds the canonical Electron spec and proves it clears
  both gates) plus captured evidence of the live run — not a committed runnable Electron spec under
  `tests/authored/` (that would make `RUN_AUTHORED` require electron everywhere).
- **−** The app path is resolved at two layers (env var, then literal fallback); intentional, so the
  spec runs standalone yet can be retargeted without editing source.
