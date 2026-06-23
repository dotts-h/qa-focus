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
- [~] Published to npm (typed, from #0005; `private:true` flips on publish); `npx qa-focus explore`
      works from a clean install.
      → **publish-READY** and clean-install-verified (`npm pack` → install the tarball in a clean dir
      → `qa-focus --version`/`--help`/dispatch run from the compiled `dist/bin`, `@playwright/cli`
      installs as a dep, and `import { … } from 'qa-focus'` exposes the typed core). The actual
      `npm publish` (flip `private:false`) is the remaining **operator step** — needs the npm token.
- [x] README quickstart; respects existing env contract (GOAL/START_URL/PW_CHANNEL/FLOW/...).
      → README "CLI" section (npx/-g usage, flags→env contract).

## Notes
No MCP (ADR 0003). Wraps `bin/explore.mts`/`codify.mts`/`interactive.mts` behind one CLI. JS
scaffold landed; ported to TypeScript under #0005. **Remaining: only the `npm publish` itself**
(flip `private:false`) — everything it depends on is done.

**"Works from a clean install" — blockers surfaced by the #0005 review — RESOLVED:**
- ✅ `src/pwcli.mts` now resolves the `@playwright/cli` bin via `createRequire(import.meta.url)`
  (correct from `dist/src/` and a consumer install) and runs it through `node`; `@playwright/cli`
  (+ `@axe-core/playwright`) moved to **dependencies**, and the `"*"` deps pinned to caret ranges.
  Verified by `tests/pwcli.spec.ts` (real CLI attach + snapshot) and the clean-install pack smoke.
- ✅ The demo server (`fixtures/app/server.mjs`, repo-only) is spawned only when present, so an
  installed `qa-focus` points `START_URL` at the user's own app. `version()` already correct (#0005).
