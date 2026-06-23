# CONTEXT.md — the qa-focus domain glossary (ubiquitous language)

> The **single source of truth for what each domain term means.** Define a term here
> **once**; code comments, ADRs, and issues use it without re-defining. If a term's
> meaning changes, change it here and let the pointers follow. Read this before
> naming a new type or writing a doc; **add a term here before you write its code.**
>
> Format: **term** — one-line meaning · *where it lives* (module/symbol) · linked ADR
> when a decision shaped it.

## Product framing

- **qa-focus** — Control-first agentic QA on the GitHub Copilot SDK + Playwright.
- **Differentiators (the axes features are ranked against):** (1) *control over the loop* — the
  program owns the loop, the model fills typed holes, a deterministic gate verifies each step;
  (2) *durable output* — discovered flows are hardened into standards-compliant tests safe to gate
  a release, not throwaway scripts.

## Domain terms

- **Explorer** — the autonomous *discovery* mode · `bin/explore.mjs`. Roams an app toward a goal,
  emits an evidence artifact a human verifies. Nondeterministic by design — see [ADR 0001](adr/0001-no-mcp-use-playwright-cli.md).
- **Codifier** — the *hardening* mode · `bin/codify.mjs` (+ the extension). Turns one discovered
  flow into a durable, gate-clean Playwright spec under `tests/authored/`.
- **The gate (locator-priority gate)** — `extension/qa-focus/ladder.mjs`. Grades a proposed locator
  against the live `Page` and rejects anything a higher-priority accessible locator would resolve.
- **Locator ladder** — the priority order the gate enforces: `role > label > placeholder > text >
  altText > title > testid > scoped > css/xpath`.
- **Scoped locator** — an accessible-ancestor-scoped locator (`getByRole('row',{name}).getByRole(…)`)
  used to disambiguate a non-unique accessible name before falling to CSS.
- **Accessibility debt** — a degraded CSS/XPath locator accepted only with a required `reason` and
  logged for the app team — a backlog, not silent fragility.
- **The leash (gated session)** — `createGatedSession` · `src/harness.mjs`. The control model: the
  model's entire capability surface is the custom gated tools; `onPreToolUse` denies everything else.
- **Tool-gating** — the prompt-injection defense: the model holds *no* fs/shell/network tool, so a
  hostile page has nothing to act with. See [ADR 0001](adr/0001-no-mcp-use-playwright-cli.md).
- **Surface** — a browser target abstraction (web / Electron / OpenFin) · `src/provider.mjs`.
- **Frame degradation** — the gate prefers `frameLocator` (`<iframe>`) and degrades to the Frame API
  (`page.frame({name})`) for legacy `<frameset>` — see [ADR 0002](adr/0002-extract-gated-session-harness.md) sibling work.
- **Evidence artifact** — the Markdown report (steps, findings, console/network anomalies, trace) ·
  `src/evidence.mjs`.
- **Finding** — a reported bug/usability/a11y item for human verification; `source: 'axe'` findings
  are tool-verified, model findings are human-verified.
- **Standards linter** — `src/standards.mjs`. Rejects authored specs that break the Playwright
  standards (no hard sleeps, no networkidle, no raw handles, no XPath).

## Infrastructure terms

- **`storageState`** — a captured login (cookies + localStorage) reused so authenticated flows skip
  re-login · `src/provider.mjs` + the `save_auth` tool.
- **`STEP_BUDGET`** — the circuit-breaker: tool calls past this count are denied (runaway-loop guard).
- **`RUN_AUTHORED`** — env flag that includes `tests/authored/` specs (which hit the network); unset
  by default so `npm test` stays offline.
- **`pwcli` / `attachCli`** — the token-efficient CLI action surface and the helper that attaches it
  to a surface · `src/pwcli.mjs`.
