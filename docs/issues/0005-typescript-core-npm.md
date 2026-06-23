---
id: 0005
title: Migrate core to TypeScript + publish typed npm package
status: closed
severity: high
group: 0001
depends_on: []
github: 6
forgejo:
links:
  adr: 0004
  prs: [feat/typescript-core-npm]
  issues: [0006]
  regression:
assets: []
---

## Summary
Port `src/` + `extension/` `.mjs` → `.ts` (strict `tsconfig`), add a build emitting ESM JS + `.d.ts`
to `dist/`, so the seams in CONTRACTS.md ship as types. Phased, module-by-module, gate green each step.

## Acceptance
- [x] `tsconfig.json` (strict) + build (tsc/esbuild) → `dist/` with `.d.ts`.
      → `tsconfig.json` (NodeNext, strict, declaration); `npm run build` (`tsc`) → `dist/` with `.mjs` + `.d.mts`.
- [x] All core modules ported; deterministic suite green throughout.
      → all 18 `.mjs` → `.mts` (NodeNext maps a `.mjs` import specifier → its `.mts` source, so no import churn); 51 specs pass / 5 live-skip.
- [x] CI gains `tsc --noEmit` type-check.
      → `npm run lint` runs `tsc --noEmit` (CI Lint step) + a dedicated CI Build step emits the typed `dist/`.
- [x] Public seams (gate proposal, tool descriptor, flow step, healer result) exported as types.
      → `Proposal`/`GradeResult`, `ToolDescriptor`/`ToolDef`, `Flow`/`FlowStep`, `HealResult`, … re-exported from `src/index.mts`.

## Notes
Foundational for the npm package (#0006). Dev keeps fast iteration via `tsx` (`npm run explore|codify|interactive`).
Closed by branch `feat/typescript-core-npm`. The actual `npm publish` (flipping `private:false`) stays on
**#0006** — package.json is now publish-ready (`main`/`types`/`exports`/`bin` → `dist/`, `files:[dist]`).
