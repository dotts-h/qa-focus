# CONTRACTS.md — qa-focus stable promises

> The registry of seams: interfaces, routes, event vocabularies, schemas, and
> invariants other code (or other repos) relies on. Changing anything listed
> here is **deliberate** — it gets a decision record and a coordinated rollout,
> never a drive-by edit. This is an *index*, not a prose copy: each entry states
> the shape tersely and points at the source of truth.

## Internal seams

> Promises between modules inside this repo. Since [ADR 0004](adr/0004-typescript-core-and-npm-package.md)
> the core is TypeScript: each seam below ships as an **exported type** (e.g. `Proposal`, `GradeResult`,
> `Flow`/`FlowStep`, `HealResult`, `ToolDescriptor`), re-exported from `src/index.mts` and emitted as
> `.d.mts` to `dist/` — so the shapes are now compile-checked, not just prose.

| seam | shape (one line) | stability | owner / source |
|------|------------------|-----------|----------------|
| Locator ladder | priority order `role > label > placeholder > text > altText > title > testid > scoped > css/xpath` | **stable** — the gate's core | `extension/qa-focus/ladder.mts` (`TIERS`) |
| `gradeLocator(page, proposal)` | → `{ ok, tier, degraded, frameDegraded, debt, suggestedTier? }`; accepts only a locator resolving to exactly 1 element that no higher tier resolves | **stable** | `extension/qa-focus/ladder.mts` |
| Gated tool descriptor | `{ name, def: { description, parameters (JSON Schema), handler } }` — the model's only way to act | **stable** | `src/browser-tools.mts`, `src/codify-tools.mts` |
| `createGatedSession({cli,model,tools,stepBudget,recency,quiet})` | → `{ session, client, toolNames, flushStream, detachStream, getUsage }`; the hard leash (cage + deny + budget) + the observability taps: live run-stream (#0013, `quiet`-gated) + cost/usage meter (#0014, always-on) | **stable** — the injection defense | `src/harness.mts` · [ADR 0002](adr/0002-extract-gated-session-harness.md) |
| `openSurface({kind,channel,…,storageState,window})` | → `{ kind, context, page, cdpEndpoint, saveState, close }` across web/electron/openfin; openfin accepts a `window` matcher | **stable** | `src/provider.mts` · [ADR 0001](adr/0001-no-mcp-use-playwright-cli.md) |
| `listWindows(browser)` / `pickWindow(browser, {url?,title?})` | enumerate / select an OpenFin (CDP) window across contexts; `pickWindow` → `undefined` on no match (never a wrong window) | **stable** | `src/provider.mts` |
| Action driver | `PwCli` shape `cmd('snapshot'\|'goto'\|'click'\|'fill'\|'press') → { ok, out }`; `attachCli` (CDP, web/openfin) and `attachInProcess` (Electron, no CDP) are interchangeable backends → `{ pwcli, getCtx }` | **stable** | `src/pwcli.mts`, `src/inproc-driver.mts` · [ADR 0005](adr/0005-in-process-action-adapter-electron.md) |
| `makeAllowlist(patterns)` / `guardContext(ctx, allow)` | URL predicate + network-layer navigation guard | **stable** | `src/allowlist.mts` |
| `lintSpec(source)` | → `{ ok, violations: [{ rule, line, snippet, why }] }` (Playwright standards) | **stable** | `src/standards.mts` |
| Authored auth reuse | `resolveStorageState(path, exists?)` → reuse capture iff it exists, else `undefined`; authored specs import `tests/authored/fixtures.ts` (`test`/`expect`) for storageState reuse + unauth fallback | **stable** | `src/authored.mts`, `tests/authored/fixtures.ts` |
| Locator healer (M5) | `healLocator(page, broken)` → `{ healed:true, needsConfirmation, proposal, locator, tier }` (gate-verified replacement) or `{ healed:false, reason }`. NEVER silently rewrites a passing test; refuses ambiguous recovery. Wired as the `heal_locator` codify tool. **Trace-driven** (#0010): `extractTraceContext(snapshotPage, broken)` recovers the intended element's accessible ancestor scope from a failure trace's DOM snapshot; `healFromTrace(page, broken, traceCtx)` re-grades the scoped candidate on the live page — resolving an ambiguity the flat healer refuses, same gate-verified/needs-confirmation contract. | **stable** | `src/healer.mts` |
| Evidence artifact | `sink { steps, console, network, shots, thirdPartyBlocked }` + `finding { severity, title, detail, source }` → Markdown, with an optional `## Usage & cost` section when `renderArtifact` is passed `usage` (#0014) | **stable** | `src/evidence.mts` |
| Flow artifact (explorer→codifier) | `{ goal, startUrl, surface, steps[], usage? }`; `step = { action: goto\|click\|fill\|press\|expect, role?, name?, text?, url?, key?, frame?, submit? }` — DURABLE accessible steps (not refs); `usage` = the run's token/AI-Credits summary (#0014). Explorer writes `artifacts/explore-flow.json`; codifier reads it via `FLOW=…` as a seed. A seed to re-walk + gate-harden, **never** trusted output. | **stable** | `src/flow.mts` (`newFlow`/`parseSnapshotRefs`/`recordStep`/`flowToSeed`/`isFlow`) |
| Usage summary (cost) | `accumulateUsage(records, {creditsToUsd?}) → { requests, totals{input,output,cacheRead,cacheWrite,reasoning,total}, models[], aiCredits?, usd? }`; AI-Credits summed from `copilotUsage.totalNanoAiu`, `$` only from a user rate (`QA_AIU_USD`) | **stable** | `src/cost.mts` (`accumulateUsage`/`formatUsage`/`renderCostSummary`/`attachCostMeter`) |

## Provides (consumed by other repos)

> Machine-checked by `fleet-doctor.sh`. Format — one bullet per contract:
> ``- `contract-id` — description · shape/schema pointer``
> The id is fleet-unique, kebab/dot style (e.g. `acme.users.api-v1`).

- *(none yet)*

## Consumes (provided by other repos)

> Same format. Every id listed here must be **provided** by exactly one sibling
> repo in the fleet's `constellation.yaml` — the fleet doctor fails otherwise.

- *(none yet)*

## Invariants

> Cross-cutting promises that aren't a single seam (determinism, ordering,
> escaping, atomicity). Each cites its decision record.

- **Injection defense (the leash).** In the standalone harnesses the model holds *no*
  fs/shell/network tool — its entire capability surface is the gated browser/codify tools. A
  hostile page cannot make it exfiltrate, because the capability is absent, not just restricted. ·
  [ADR 0001](adr/0001-no-mcp-use-playwright-cli.md), `src/harness.mts`.
- **No raw shell to the model.** Browser actions go through gated `defineTool`s wrapping
  `@playwright/cli` with argv-discrete `execFile` (no shell) — a page's text can only ever be a
  value, never a command. · [ADR 0001](adr/0001-no-mcp-use-playwright-cli.md), `src/pwcli.mts`.
- **Offline deterministic suite.** `npm test` never hits the network or the model: LIVE specs skip
  without `LIVE=1`; authored specs are excluded without `RUN_AUTHORED=1`. · `playwright.config.ts`.
- **Findings are never self-certified.** The explorer reports findings for human verification;
  `source: 'axe'` findings are tool-verified. · `src/evidence.mts`.
