# Playwright standards & complex-surface handling

What the gate, the standards prompt, and the spec-linter enforce — and the honest limits
on complex enterprise apps (Angular, iframes, shadow DOM). Researched against current
Playwright (1.6x) docs and E2E best practice.

## Locator priority (the gate — `extension/qa-focus/ladder.mjs`)
`role > label > placeholder > text > altText > title > testid > scoped (accessible parent+child) > css > xpath`

The gate grades a proposed locator on the **live page**, re-deriving higher-priority
alternatives from the resolved element and rejecting anything weaker than the best that
uniquely resolves. CSS/XPath are last-resort and require a written `reason` (logged as
accessibility debt). It enforces **strict single-element resolution** (exactly 1).

## Stability rules (the spec-linter — `src/standards.mjs`)
Authored specs are **rejected** at `write_spec` time if they contain:
- `waitForTimeout` — hard sleeps are flaky; use web-first assertions (auto-retry).
- `networkidle` — unreliable on SPAs/Angular (constant polling/XHR).
- `page.$` / `page.$$` — static handles with no auto-waiting; use locators.
- XPath (`xpath=` or `locator('//…')`) — **does not pierce shadow DOM** and is brittle.

Advisory (warn, not block): `waitForSelector` (superseded by auto-waiting locators).

## iframes
- `page.getByRole(...)` does **not** pierce iframes. Durable in-frame locators must be
  scoped: `page.frameLocator('iframe[title="Editor"]').getByRole(...)`. The gate accepts a
  `frame` selector and renders the `frameLocator(...)` prefix; `propose_locator` /
  `browser_expect_visible` take `frame`.
- The `@playwright/cli` snapshot surfaces `<iframe>` content inline with **frame-prefixed
  refs** (`f1e5`), so the explorer's `browser_click`/`browser_fill` act inside iframes by
  ref with no extra plumbing.
- **Limitation:** legacy `<frameset>`/`<frame>` documents are not surfaced inline by the
  snapshot (modern apps use `<iframe>`, which works). Nested `<iframe>`s require chaining
  `frameLocator(...).frameLocator(...)` — single-level `frame` is supported today.

## Shadow DOM
- **Open** shadow roots are pierced automatically by `getByRole`/`getByText`/CSS — no
  special handling (verified live against a real MDN web component). XPath does NOT pierce.
- **Closed** shadow roots are invisible to both Playwright and the snapshot. Run with
  `FORCE_OPEN_SHADOW=1` to rewrite `attachShadow` so all roots open before page scripts run
  (`src/provider.mjs`) — needed for closed web-component apps (e.g. Salesforce LWC). Off by
  default (it changes app behavior).

## Angular specifics
- Don't wait on `networkidle`; rely on web-first assertions through change-detection cycles.
- Angular Material exposes ARIA roles (`combobox`, `menuitem`, `dialog`) — prefer them.
- `mat-select`/`mat-dialog`/tooltip render in `.cdk-overlay-container` at `<body>`, not under
  the trigger — find them at document level (the gate searches the whole page, so this works;
  the row-scoping heuristic only applies to true DOM ancestors).
- Virtual-scroll lists (`cdk-virtual-scroll-viewport`) only render visible rows — scroll the
  viewport to reveal more before asserting.

## Test framework (the "framework building" question)
For a production suite on a big app it **does** matter — but stay lean. Modern Playwright
consensus: **fixtures that inject Page Object Models**, flat readable `.spec.ts` files with
assertions in the spec (not abstracted into POMs), and a config with
`trace: 'retain-on-failure'` + `storageState` for auth reuse. Over-engineering to avoid:
deep class hierarchies, wrapping `expect`.

**Current state:** the codifier emits gate-checked, linted flat specs into `tests/authored/`
and runs them through the real `playwright test` gate. **Roadmap:** generate a `fixtures.ts`
that injects POMs and a `storageState` auth-reuse step (see PLAN M5+).
