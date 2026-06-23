---
id: 0006
title: Standalone CLI npm package (qa-focus explore|codify|interactive)
status: in-progress
severity: high
group: 0001
depends_on: [0005]
github: 7
forgejo:
links:
  adr: 0003
  prs: []
  issues: [0007, 0008]
  regression:
assets: []
---

## Summary
Publish the autonomous harnesses as an installable CLI — `qa-focus <explore|codify|interactive>` —
embedding `@github/copilot-sdk` directly (the SDK is standalone; no `copilot` binary required to
build an agent). The **primary v1 deliverable**.

## Acceptance
- [x] `package.json` `bin` entries; a single `qa-focus` entrypoint with subcommands + `--help`.
      → `bin/qa-focus.mjs` (flags → harness env contract), `tests/cli.spec.ts` (5).
- [ ] Published to npm (typed, from #0005; `private:true` flips on publish); `npx qa-focus explore`
      works from a clean install.
- [ ] README quickstart; respects existing env contract (GOAL/START_URL/PW_CHANNEL/FLOW/...) ✓ (contract honored; README pending).

## Notes
No MCP (ADR 0003). Wraps `bin/explore.mts`/`codify.mts`/`interactive.mts` behind one CLI. JS
scaffold landed; ported to TypeScript under #0005. Publish gated on #0005 (typed) + dropping
`private:true`.

**"Works from a clean install" — concrete blockers surfaced by the #0005 review (fix here):**
- `src/pwcli.mts` `DEFAULT_BIN = join(HERE, '../node_modules/.bin/playwright-cli')` resolves wrong
  from the shipped `dist/src/` (node_modules is at the package root, not under `dist/`), AND
  `@playwright/cli` is a **devDependency** — so a clean install has no playwright-cli at all.
  Resolve the bin via `createRequire(import.meta.url).resolve(...)` and move/declare
  `@playwright/cli` (+ `playwright`, `@github/copilot-sdk`) as real runtime deps/peers.
- Decide what `dist/` needs at runtime that `files:[dist]` doesn't ship (e.g. `fixtures/app` for the
  localhost smoke path in explore/interactive) — gate the demo-server spawn on its presence.
  (`bin/qa-focus.mts` `version()` already reads the root `package.json` correctly in both forms.)
