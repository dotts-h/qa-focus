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
  adr: 0003, 0006
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
- [~] ~~Published to npm~~ → **distributed from the GitHub repo** ([ADR 0006](adr/0006-no-npm-publish-distribute-from-github.md)):
      `npm i github:dotts-h/qa-focus` / `npx github:dotts-h/qa-focus`. `npm publish` is now a NON-GOAL
      (`private:true` is permanent). The typed package shape is already clean-install-verified via
      `npm pack` (the tarball path). **Remaining for git install:** add a `prepare` build script (so a
      git install compiles the gitignored `dist/`), switch the README install to the git form, and
      smoke `npx github:…`. Then close.
- [x] README quickstart; respects existing env contract (GOAL/START_URL/PW_CHANNEL/FLOW/...).
      → README "CLI" section (npx/-g usage, flags→env contract).

## Notes
No MCP (ADR 0003). Wraps `bin/explore.mts`/`codify.mts`/`interactive.mts` behind one CLI. JS
scaffold landed; ported to TypeScript under #0005. **Distribution is git-based, not npm-registry**
([ADR 0006](adr/0006-no-npm-publish-distribute-from-github.md)) — remaining work is the `prepare`
build script + README git-install + an `npx github:…` smoke (no npm token, no operator publish step).

**"Works from a clean install" — blockers surfaced by the #0005 review — RESOLVED:**
- ✅ `src/pwcli.mts` now resolves the `@playwright/cli` bin via `createRequire(import.meta.url)`
  (correct from `dist/src/` and a consumer install) and runs it through `node`; `@playwright/cli`
  (+ `@axe-core/playwright`) moved to **dependencies**, and the `"*"` deps pinned to caret ranges.
  Verified by `tests/pwcli.spec.ts` (real CLI attach + snapshot) and the clean-install pack smoke.
- ✅ The demo server (`fixtures/app/server.mjs`, repo-only) is spawned only when present, so an
  installed `qa-focus` points `START_URL` at the user's own app. `version()` already correct (#0005).
