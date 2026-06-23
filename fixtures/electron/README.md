# Electron fixture — live-surface verification

A minimal Electron app (a static Todo window with accessible role+name elements) for verifying that
the locator gate and the **in-process action driver** (`src/inproc-driver.mts`, ADR 0005) work on a
real desktop surface — Electron windows are Playwright `Page`s, so the gate and tools are unchanged.

## Prerequisite: install Electron (opt-in, not a committed dependency)

Electron ships a ~200 MB platform binary, and the live tests are **opt-in** (gated on `ELECTRON_LIVE`
/ `SURFACE=electron`), so `electron` is **deliberately not** in `package.json` — CI (`npm ci` +
`playwright install chromium`) stays lean. Install it ad-hoc when you want to run the live Electron
path:

```bash
npm install -D electron        # downloads the platform binary
```

(On a headless box, prefix the run commands with `xvfb-run -a` and pass `--no-sandbox`.)

## Run the gate tests on a real Electron window

```bash
ELECTRON_LIVE=1 xvfb-run -a npx playwright test live-electron
```

## Run the full autonomous explore → codify loop on Electron (#0026)

Uses the in-process driver (no CDP) and the installed `copilot` login (spends model credits):

```bash
# explore: a real model drives the Electron window via the in-process driver, emits a durable flow
SURFACE=electron ELECTRON_ARGS="fixtures/electron --no-sandbox" \
  GOAL="Confirm the Todo app loads; verify the heading, fill the New task field, check the Add button." \
  STEP_BUDGET=25 xvfb-run -a npx tsx bin/explore.mts

# codify: harden the discovered flow into a gate-clean spec
SURFACE=electron ELECTRON_ARGS="fixtures/electron --no-sandbox" \
  FLOW=artifacts/explore-flow.json SPEC_NAME="electron-todo" \
  xvfb-run -a npx tsx bin/codify.mts
```

> **Gotcha (REGRESSIONS #1):** launch the app **directory** (`fixtures/electron`, which has
> `package.json` `main`), never a bare `main.js`.
>
> **Note (#0027):** the codifier currently authors a *web-shaped* spec (`{ page }` + `goto`); the
> role+name locators are validated against the live Electron window, but executing the authored spec
> against Electron (`_electron.launch`) is tracked as follow-up #0027.
