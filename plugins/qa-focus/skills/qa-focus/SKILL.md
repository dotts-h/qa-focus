---
name: qa-focus
description: Control-first agentic QA — drive a real browser to explore an app, harden the discovered flow into a durable, standards-compliant Playwright test, and grade every locator through a deterministic priority gate (role > label > … > css/xpath). Use when asked to QA a web/Electron/OpenFin app, write or repair an e2e/Playwright test, find UI bugs, or turn a manual flow into an automated check. No MCP — it drives the installed copilot login.
---

# qa-focus — agentic QA, on a leash

**qa-focus** is a control-first agentic QA tool: the program owns the loop, the model fills typed
holes, and a deterministic gate verifies every locator. Two modes chain — an autonomous **explorer**
discovers flows and bugs (evidence a human verifies), feeding a gated **codifier** that hardens a
flow into a standards-compliant, durable Playwright test. It runs on web (Chrome), Electron, and
OpenFin, with **zero MCP** (ADR 0001/0003).

It ships as a git-installed CLI (no npm registry — ADR 0006). Install once, then drive it from here.

## Install (once)

```bash
npx playwright install chromium
npm i -g github:dotts-h/qa-focus      # or run ad-hoc: npx github:dotts-h/qa-focus <command>
qa-focus --help
```

## When to use this skill

- "QA this app / poke at it and report bugs" → `explore`.
- "Write / harden a Playwright test for this flow" → `codify` (seed it from an explore flow).
- "This locator is flaky / which locator should I use?" → the gate grades role+name proposals.
- Driving web, Electron, or OpenFin surfaces; reusing a captured login; running headless in a pipe.

## How to drive it

**1. Explore** — discover a flow + emit evidence (Markdown artifact + a durable `explore-flow.json`):

```bash
qa-focus explore --goal "Add a task and verify it appears" --url https://your.app
# pick a model: qa-focus models ; then --model <id>. Headless/CI: add --quiet.
```

**2. Codify** — harden the discovered flow into a gated Playwright spec (re-walks it, grading every
locator through the gate; never green-washes):

```bash
qa-focus codify --flow artifacts/explore-flow.json --spec add-task
```

**3. Interactive** — an enforcing REPL (the hard leash) for hands-on authoring:

```bash
qa-focus interactive --url https://your.app
```

## Principles to honour when you use it

- **The gate is authoritative.** Accept the locator tier it returns (role+name first; css/xpath is
  logged debt). Don't override it to make a test pass.
- **Findings are reported, never self-certified** — surface the evidence artifact for a human to verify.
- **Stay on the allowlist.** The explorer holds only browser-action tools (no fs/shell/network); a
  hostile page cannot exfiltrate. Point `--url`/`--allowlist` at the app under test.
- **No MCP.** qa-focus is a CLI/CI tool; it is not a tool-provider hosted inside another agent.

For the full flag set: `qa-focus --help`. Surfaces, standards, and the gate are documented at
https://github.com/dotts-h/qa-focus.
