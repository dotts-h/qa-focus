# ADR 0008 — The streamable REPL is built on Node `readline`, not Ink

- Status: accepted
- Date: 2026-06-23

## Context

The interactive runner should feel like a stable, Copilot-CLI-style REPL: the model's reasoning,
output, and tool-call lines **stream continuously** while the user's input prompt stays live at the
bottom. We evaluated how to build that — a full TUI framework (Ink, the React-for-CLIs library;
blessed) versus the plain Node `readline` we already use in `bin/interactive.mts`.

Verified research (nodejs.org `readline` docs; the `vadimdemedes/ink` issue tracker —
#935/#382/#359 flicker, #869 OOM regression, #701 `useInput` EventEmitter leak):

- **Ink uses full-frame reconciliation.** Under high-frequency token streaming it repaints (and on
  viewport overflow, *clears*) the frame faster than the terminal can redraw → **flicker**. It has
  also shipped memory-leak/OOM regressions and `EventEmitter` leaks under rapid re-render.
- **Critically, Ink contends for stdout with an in-process browser.** Ink needs exclusive control of
  the terminal buffer to position its cursor; a single line written by a backgrounded
  Playwright/Chromium desyncs Ink's cursor into permanently garbled output. **Our harness runs
  Playwright in the same process**, so this is a direct, not hypothetical, hazard.
- **`readline` only touches the bottom prompt line** (`clearLine` + `cursorTo` + `rl.prompt(true)`),
  so streaming output above the prompt never triggers a full redraw — **no flicker**, and it
  tolerates other writers on stdout.

## Decision

**Build the streamable REPL on plain Node `readline`.** Stream model output above a live prompt by
clearing the current line, writing the chunk, and redrawing the input with `rl.prompt(true)`. **Do
not adopt Ink or any full-screen TUI framework.** The pure events→lines renderer
(`src/stream.mts`, #0013) is the content source; `readline` is the surface.

## Options considered

1. **Node `readline` (chosen).** Native, zero new deps, no flicker, tolerant of an in-process
   browser writing to stdout. Already the basis of `bin/interactive.mts`.
2. **Ink.** Rich layout, but flicker + memory regressions under streaming and **fatal stdout
   contention with in-process Playwright**. Rejected.
3. **blessed / neo-blessed.** Full-screen TUI; same exclusive-terminal problem as Ink, heavier and
   less maintained. Rejected.
4. **`@clack/prompts`.** Great for wizard flows, but takes strict cursor control and clashes with
   continuous background streaming into a live prompt. Rejected for the REPL.

## Consequences

- The REPL stays a thin, dependency-light layer over `readline`; polishing the existing
  `bin/interactive.mts` (stream-while-typing) is the path, not a rewrite.
- Playwright/browser stdio must not interleave with the REPL — keep it piped away from the prompt
  (the runners already launch headless and route browser logs through the evidence sink).
- No heavy TUI dependency enters the tree; the surface stays portable and easy to reason about.
