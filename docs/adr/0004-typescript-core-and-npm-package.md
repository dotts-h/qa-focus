# ADR 0004 — Migrate the core to TypeScript and publish a typed npm package

- Status: accepted — the **registry-publish** clause is superseded-by-[0006](0006-no-npm-publish-distribute-from-github.md) (distribute from the GitHub repo instead); the TypeScript migration + typed exports stand.
- Date: 2026-06-23

## Context

The engine is plain JavaScript: 17 `.mjs` ESM modules (`bin/`, `src/`, `extension/`), no
`tsconfig.json`, no `typescript` dependency, no build step — `node bin/explore.mjs` just runs.
Only the tests and the specs the codifier emits are TypeScript (run via Playwright's transform).

The no-build ergonomics are nice, but qa-focus's whole value is **typed contracts**: the locator
ladder's proposal shape, the `defineTool` JSON-Schema params, the flow step union, the healer's
result type, the gate's `{ ok, tier, degraded, … }` return. Today those are enforced only by tests
and JSDoc — a malformed tool descriptor or a wrong gate-return shape is caught at runtime, if at
all. To ship a **deliverable** ([ADR 0003](0003-distribution-native-adapters-no-mcp.md)) — an npm
package others build adapters on — we also need to ship **types** (`.d.ts`), so consumers get
autocomplete and compile-time safety against the seams in CONTRACTS.md.

## Decision

**Migrate the core to TypeScript and publish a typed npm package.**

- `src/` and `extension/` `.mjs` → `.ts`; add a `tsconfig.json` (strict) and a build
  (tsc or esbuild/tsup) emitting ESM JS **+ `.d.ts`** to `dist/`.
- The published package exposes the portable core (gate, flow, healer, standards, provider,
  browser/codify tool factories) with full types; the CLI bins ship as package `bin` entries.
- Dev keeps fast iteration via `tsx`/`ts-node` (or a watch build) so `node bin/...` ergonomics
  survive as `npm run explore` etc.
- Migration is **phased and mechanical** — module by module, the green deterministic gate proving
  each step; the public seams (CONTRACTS.md) get explicit exported types first.

## Options considered

1. **Stay JS + JSDoc.** Zero migration cost. **Rejected:** no compile-time safety on the exact
   things that matter (tool schemas, gate/flow/healer shapes), and a published JS-only package is a
   weaker deliverable — consumers building adapters get no types for the seams.
2. **Full TypeScript migration + typed package (chosen).** Costs a build step and a mechanical port,
   but types the core, matches the already-TS test/spec layer, and makes the npm package
   professional-grade.
3. **TypeScript only for new adapter code, JS core.** Half-measure. **Rejected:** leaves the gate
   and tool factories — the highest-value contracts — untyped, and forces `.d.ts` hand-authoring or
   `any` at the boundary.

## Consequences

- A build step appears (`dist/` with JS + `.d.ts`); CI gains a `tsc --noEmit` type-check gate.
- The seams in CONTRACTS.md become compile-checked exported types; adapters consume them safely.
- Toolchain consistency: tests/specs were already TS; the whole repo speaks one language.
- The migration is incremental and low-risk (the deterministic suite guards each module); it is a
  prerequisite for the npm package but does not block CLI/surface work, which can proceed in JS and
  be ported alongside.
