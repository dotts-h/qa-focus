# ADR 0006 — No npm registry publish; distribute from the GitHub repo

- Status: accepted
- Date: 2026-06-23
- Supersedes (in part): [ADR 0003](0003-distribution-native-adapters-no-mcp.md) deliverable #1
  ("standalone CLI **npm package**") and [ADR 0004](0004-typescript-core-and-npm-package.md) (its
  "**publish** a typed npm package" clause). The TypeScript migration, the typed `exports`, and the
  CLI-first / zero-MCP posture all stand — only the *registry publish* is reversed.

## Context

ADR 0003 set v1 as CLI-first with three git-friendly deliverables; deliverable #1 was a standalone
CLI "npm package," and ADR 0004 said to "publish a typed npm package." Issue #0006 carried that to
**publish-ready and clean-install-verified** (`npm pack` → install the tarball in a clean dir →
`qa-focus --version`/`--help`/dispatch run from the compiled `dist/bin`; `import { … } from
'qa-focus'` exposes the typed core). The only thing left was the literal `npm publish` (flip
`private:false`) — an operator step needing an npm token + namespace.

The maintainer decided that registry publish isn't worth the token / namespace / ongoing-release
overhead. The repo is public (Apache-2.0), the audience is CLI/CI users who already have `git`, and
ADR 0003 already embraces **git-based, decentralized distribution** (the Copilot plugin ships via
the *git* marketplace, not a registry). So the registry adds operator burden without added reach.

## Decision

**qa-focus is not published to the public npm registry. The GitHub repo IS the distribution
channel.** Install is git-based:

- `npm i github:dotts-h/qa-focus` (as a dependency, exposes the typed core + the `qa-focus` bin),
- `npx github:dotts-h/qa-focus explore|codify|interactive` (one-shot), or
- clone + `npm i` + `npm run build`.

- `package.json` stays **`private: true`** — it documents the intent and guards against an
  accidental `npm publish`.
- The package keeps its real shape — typed `exports`, `bin`, `files: ["dist"]` — so a git install
  resolves the CLI and the typed core exactly as a registry install would.
- A **`prepare` build script** (`tsc`) compiles `dist/` on install, because `dist/` is gitignored
  and npm runs `prepare` after a git install (a registry install would have shipped a prebuilt
  `dist/` in the tarball; a git install builds it).

## Options considered

1. **Publish to npm (status quo, ADR 0003/0004).** Rejected: needs an npm token + namespace + an
   ongoing release operator step the maintainer doesn't want, with no added reach for a CLI/CI
   audience that already has `git`.
2. **Distribute from the GitHub repo (chosen).** Zero registry/token/namespace overhead; consistent
   with the git-based plugin marketplace already chosen in ADR 0003; one source of truth (the repo).
3. **Commit `dist/` to the repo** to skip build-on-install. Rejected: generated artifacts in git rot
   and bloat diffs; a `prepare` build is the npm-native git-install path.

## Consequences

- `npm publish` is a **non-goal**; `private: true` is permanent. Versioning, if wanted, is a tagged
  **GitHub release** (the `cut-release` flow: built artifacts + checksums + notes), not a registry.
- A **`prepare` script** must exist so `npm i github:dotts-h/qa-focus` builds `dist/` (a task under
  #0006). Note the build-time cost: a git install runs `tsc` (devDependencies install too).
- README install switches to the **git form** (`npm i github:…` / `npx github:…`), not
  `npm i -g qa-focus`.
- #0006's remaining "npm publish" acceptance is replaced by "**git install works**"; once the
  `prepare` script + a git-install smoke land, #0006 closes.
- **#0007** (Copilot plugin via the git marketplace) and **#0008** (GitHub Action, run from the repo
  build) never needed a registry publish and are **unblocked** — both reference the repo, not a
  published package. The `depends_on: [0006]` edges hold only until #0006's git-install close-out.
- `@github/copilot-sdk` and `@playwright/cli` still install transitively on a git install (normal
  dependencies), so `npx github:…` pulls them.
