# ADR 0002 — Extract the gated-session control model into one seam

- Status: accepted
- Date: 2026-06-23

## Context

ARCHITECTURE.md §"Control is the engine" describes the leash as a single coherent control
model: `availableTools` caged to custom-only, `onPreToolUse` denies any non-gated tool, an
optional `STEP_BUDGET` circuit-breaker, `approveAll`, and an `onUserPromptSubmitted` recency
hook — all over `RuntimeConnection.forStdio` reusing the installed Copilot login.

In the code that control model is **copy-pasted** into three entry points — `bin/explore.mjs`,
`bin/codify.mjs`, `bin/interactive.mjs` (and partially the legacy `bin/author.mjs`). Each
re-creates the `CopilotClient`, the `ToolSet().addCustom('*')` cage, the `onPreToolUse` deny +
budget logic, and the tool-name allowlist. Consequences observed:

- **The security guarantee has no single home.** The leash *is* the prompt-injection defense
  (ADR 0001). A fix to it must be applied in three files and kept in sync by hand.
- **It is already drifting.** `explore`/`codify` carry a `STEP_BUDGET`; `interactive` does not;
  the deny messages and recency hooks differ subtly between files.
- **The SDK seam is wider than necessary.** `@github/copilot-sdk` is imported by four `bin/`
  files; the cage primitives (`ToolSet`, `defineTool`, `approveAll`, `RuntimeConnection`) leak
  into every runner instead of living behind one boundary.

## Decision

Extract the control model into **`src/harness.mjs`**, exporting `createGatedSession(...)` — the
one place that owns the leash, the budget, the recency hook, and the only import site of the
Copilot SDK session primitives. Entry points pass their tools + options and receive a
`{ session, client }`; they keep only what genuinely differs (surface setup, one-shot GOAL vs
stdin REPL, artifact writing).

What is **not** extracted (deliberately, per simplicity-first): surface orchestration
(`openSurface` + tracing + collectors + fixture-server spawn) stays in each runner — its
variation is real (tracing on/off, REPL vs one-shot, a localhost fixture), and forcing it
behind one helper would over-abstract. `bin/author.mjs` is the legacy proof harness
(superseded by `codify.mjs`) and is left as-is, marked legacy.

## Options considered

1. **Leave it** — three copies, drift continues, the leash risks diverging into a gap. Rejected:
   a security guarantee must not be three hand-synced copies.
2. **Extract the whole runner** (surface + session + loop) — one mega-factory. Rejected:
   over-couples the real variation (REPL vs one-shot, tracing, fixtures) and is harder to read.
3. **Extract only the gated session (chosen)** — the security-critical, genuinely-identical
   part gets one home; the legitimately-varying parts stay local.

## Consequences

- The injection-defense leash is defined once; a change applies everywhere at once.
- The SDK session primitives are imported by exactly one `src/` module + the extension's
  `joinSession`; runners no longer touch them.
- `STEP_BUDGET` becomes a uniform option (interactive can opt in; today it silently lacked one).
- Slight indirection: reading a runner now requires opening `harness.mjs` to see the leash —
  acceptable, and the leash is exactly the thing that benefits from a single documented home.
