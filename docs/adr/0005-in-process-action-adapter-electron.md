# ADR 0005 — In-process action adapter for Electron (the CDP CLI can't attach)

- Status: accepted
- Date: 2026-06-23

## Context

[ADR 0001](0001-no-mcp-use-playwright-cli.md) chose the `@playwright/cli` model for browser
actions: our in-process Playwright owns the browser, and the CLI **attaches to it over a CDP
http endpoint** to serve the model compact `[ref=eN]` snapshots (token-efficient, gated, no raw
shell). That works for **web** (`chromium.launch --remote-debugging-port`) and **OpenFin**
(`connectOverCDP`), where a CDP endpoint exists.

**Electron has no such endpoint.** `_electron.launch()` hands Playwright a `Page` whose lifecycle
*we* own; there is no `--remote-debugging-port` http server for an external CLI process to attach
to. So while the locator **gate** already works on Electron (an Electron window *is* a Playwright
`Page` — proven by `tests/live-electron.spec.ts`), the explorer/codifier could not *act* on it:
their browser tools (`src/browser-tools.mts`) drive everything through the CLI, which can't reach
Electron. Electron was gate-verified but not drivable.

## Decision

**Add an in-process action driver (`src/inproc-driver.mts`) that implements the same `PwCli`
shape and acts on the Playwright `Page` directly; select it for surfaces with no CDP endpoint.**

- The browser tools and the gate are built against one narrow interface —
  `pwcli.cmd('snapshot' | 'goto' | 'click' | 'fill' | 'press') → { ok, out }`. `attachInProcess({ page })`
  returns a `PwCli` that satisfies it without a CLI subprocess, so **`browser-tools.mts`, the
  leash, and the gate are unchanged** — only the action *backend* is swapped.
- `snapshot` tags each actionable/landmark element with a `data-qaf-ref` attribute and emits the
  same `- <role> "<name>" [ref=eN]` lines the CLI does, so `parseSnapshotRefs` (flow capture) and
  the by-ref actions work identically; `click`/`fill`/`press` resolve a ref via
  `[data-qaf-ref="…"]`.
- The runners pick the backend by surface: a CDP endpoint → `attachCli` (ADR 0001); Electron (no
  endpoint) → `attachInProcess`. web/openfin still **require** a CDP endpoint (unchanged error).

## Options considered

1. **Force a CDP endpoint onto Electron.** Electron can be told to open a remote-debugging port,
   but then you connect a *second* Chromium client over CDP to a process Playwright already drives
   in-process — two owners of one browser, lifecycle/race hazards, and it abandons the deep
   `_electron` main-process access that is the reason to use `_electron.launch` at all. Rejected.
2. **In-process driver behind the same PwCli interface (chosen).** One new module; the security
   model (tool-gating leash) and the gate are untouched because the model still only ever calls
   the same gated tools. The driver needs only a `Page`, so it is surface-agnostic and unit-tested
   on plain chromium (a real signal with no Electron binary, display, or model/quota).
3. **A separate Electron-specific tool set.** Duplicates `browser-tools.mts` for one surface —
   exactly the hand-synced divergence ADR 0002 consolidated away. Rejected.

## Consequences

- Electron is now drivable by the explorer/codifier, not just gradeable. The runners skip the
  `START_URL` navigation for `kind: 'electron'` (the app loads its own content via
  `_electron.launch`/`loadFile`); point a run at an app with `SURFACE=electron ELECTRON_ARGS=<app dir>`,
  not a URL.
- Two action backends share one interface; future no-CDP surfaces reuse the in-process driver.
- The in-process snapshot is a **flat list of actionable elements** (not the CLI's indented tree)
  and infers role/name with a focused in-page mapper rather than Chromium's full accessibility
  computation — sufficient to drive (the gate stays authoritative for locator quality), but a
  deliberately smaller surface than the CLI snapshot. `--depth` is accepted and ignored.
- Verified: `tests/inproc-driver.spec.ts` (deterministic, chromium) proves snapshot/ref/act; the
  opt-in `ELECTRON_LIVE` test in `tests/live-electron.spec.ts` proves it on a real Electron window.
