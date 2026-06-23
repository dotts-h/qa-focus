---
id: 0005
title: Migrate core to TypeScript + publish typed npm package
status: open
severity: high
group: 0001
depends_on: []
github: 6
forgejo:
links:
  adr: 0004
  prs: []
  issues: [0006]
  regression:
assets: []
---

## Summary
Port `src/` + `extension/` `.mjs` → `.ts` (strict `tsconfig`), add a build emitting ESM JS + `.d.ts`
to `dist/`, so the seams in CONTRACTS.md ship as types. Phased, module-by-module, gate green each step.

## Acceptance
- [ ] `tsconfig.json` (strict) + build (tsc/esbuild) → `dist/` with `.d.ts`.
- [ ] All core modules ported; deterministic suite green throughout.
- [ ] CI gains `tsc --noEmit` type-check.
- [ ] Public seams (gate proposal, tool descriptor, flow step, healer result) exported as types.

## Notes
Foundational for the npm package (#0006). Dev keeps fast iteration via `tsx`/watch build.
