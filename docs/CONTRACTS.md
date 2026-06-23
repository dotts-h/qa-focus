# CONTRACTS.md — qa-focus stable promises

> The registry of seams: interfaces, routes, event vocabularies, schemas, and
> invariants other code (or other repos) relies on. Changing anything listed
> here is **deliberate** — it gets a decision record and a coordinated rollout,
> never a drive-by edit. This is an *index*, not a prose copy: each entry states
> the shape tersely and points at the source of truth.

## Internal seams

> Promises between modules inside this repo.

| seam | shape (one line) | stability | owner / source |
|------|------------------|-----------|----------------|
| Locator ladder | priority order `role > label > placeholder > text > altText > title > testid > scoped > css/xpath` | **stable** — the gate's core | `extension/qa-focus/ladder.mjs` (`TIERS`) |
| `gradeLocator(page, proposal)` | → `{ ok, tier, degraded, frameDegraded, debt, suggestedTier? }`; accepts only a locator resolving to exactly 1 element that no higher tier resolves | **stable** | `extension/qa-focus/ladder.mjs` |
| Gated tool descriptor | `{ name, def: { description, parameters (JSON Schema), handler } }` — the model's only way to act | **stable** | `src/browser-tools.mjs`, `src/codify-tools.mjs` |
| `createGatedSession({cli,model,tools,stepBudget,recency})` | → `{ session, client, toolNames }`; the hard leash (cage + deny + budget) | **stable** — the injection defense | `src/harness.mjs` · [ADR 0002](adr/0002-extract-gated-session-harness.md) |
| `openSurface({kind,channel,…,storageState})` | → `{ kind, context, page, cdpEndpoint, saveState, close }` across web/electron/openfin | **stable** | `src/provider.mjs` · [ADR 0001](adr/0001-no-mcp-use-playwright-cli.md) |
| `makeAllowlist(patterns)` / `guardContext(ctx, allow)` | URL predicate + network-layer navigation guard | **stable** | `src/allowlist.mjs` |
| `lintSpec(source)` | → `{ ok, violations: [{ rule, line, snippet, why }] }` (Playwright standards) | **stable** | `src/standards.mjs` |
| Evidence artifact | `sink { steps, console, network, shots, thirdPartyBlocked }` + `finding { severity, title, detail, source }` → Markdown | **stable** | `src/evidence.mjs` |

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
  [ADR 0001](adr/0001-no-mcp-use-playwright-cli.md), `src/harness.mjs`.
- **No raw shell to the model.** Browser actions go through gated `defineTool`s wrapping
  `@playwright/cli` with argv-discrete `execFile` (no shell) — a page's text can only ever be a
  value, never a command. · [ADR 0001](adr/0001-no-mcp-use-playwright-cli.md), `src/pwcli.mjs`.
- **Offline deterministic suite.** `npm test` never hits the network or the model: LIVE specs skip
  without `LIVE=1`; authored specs are excluded without `RUN_AUTHORED=1`. · `playwright.config.ts`.
- **Findings are never self-certified.** The explorer reports findings for human verification;
  `source: 'axe'` findings are tool-verified. · `src/evidence.mjs`.
