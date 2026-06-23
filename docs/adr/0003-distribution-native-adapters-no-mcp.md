# ADR 0003 — v1 distribution: CLI-first, native adapters, ZERO MCP

- Status: accepted — deliverable #1's **npm-registry publish** is superseded-by-[0006](0006-no-npm-publish-distribute-from-github.md) (the CLI ships from the GitHub repo via git install); CLI-first + zero-MCP + the three adapters all stand.
- Date: 2026-06-23

## Context

To reach a v1 *deliverable* (something others install and run, not a repo you clone), we
asked: how does qa-focus reach its users — the autonomous CLI, CI, and interactive sessions?

Verified research (2026, primary sources):
- **The core is already portable.** Of the runtime files, only `src/harness.mjs` and
  `extension/qa-focus/extension.mjs` import `@github/copilot-sdk`. The whole non-commodity core —
  the locator gate (`ladder.mjs`), `flow.mjs`, `healer.mjs`, `standards.mjs`, `browser-tools.mjs`,
  `codify-tools.mjs`, `provider.mjs` — is SDK-free and model/client-agnostic.
- **`@github/copilot-sdk` is a standalone library** (the agentic engine behind the CLI). A
  standalone agent can embed it without the `copilot` binary — which is exactly what
  `bin/explore.mjs`/`codify.mjs` already do.
- **The Copilot CLI has a native plugin model** (verified from the binary): `copilot plugin` —
  "plugins extend Copilot CLI with additional skills, agents, hooks, MCP servers, and LSP servers…
  installed from plugin marketplaces, GitHub repositories, repository subdirectories, or direct git
  URLs." Packaging is a `plugin.json` manifest; distribution is decentralized/git-based.
- **MCP is the technical "universal adapter."** A single MCP server exposing our tools would be
  consumable by the Copilot CLI, VS Code Copilot (GA), Cursor, Claude, and Windsurf alike. Several
  of those editors accept third-party *tools* **only** via MCP.

So MCP is the cheapest route to broad editor reach. We reject it anyway (see Decision).

## Decision

**qa-focus is a CLI tool. v1 ships as CLI tools, and there is ZERO MCP anywhere — neither
consumed nor provided, not now, not as a "later" option.** This reaffirms and extends
[ADR 0001](0001-no-mcp-use-playwright-cli.md) (no MCP for browser actions) to the *whole project,
distribution included*.

The deliverables, all CLI, all non-MCP:
1. **Standalone CLI (npm package)** — `qa-focus explore | codify | interactive`, embedding
   `@github/copilot-sdk` directly via the gated harness. **The primary product.**
2. **Copilot CLI plugin** — the existing interactive extension packaged with a `plugin.json`,
   distributed via the native git-based plugin marketplace (skills/agents/hooks only — **no MCP
   server bundled**, even though the plugin format would permit one).
3. **GitHub Action** — wraps the CLI for CI (explore a deploy preview; codify a flow; run the
   authored suite as a gate).

**Explicit NON-GOAL: IDE/editor embedding.** Living inside VS Code, Cursor, Windsurf, or Claude
Desktop is not a goal of this project — and since several of those accept third-party tools *only*
via MCP, pursuing them would force the MCP we are rejecting. qa-focus is a terminal/CI tool: the
program owns the loop, the model fills typed holes, the gate verifies. That is incompatible with
being a passive tool-provider hosted inside someone else's agent, and we are not building it.

## Options considered

1. **Expose the gate + tools as an MCP server (universal adapter).** Cheapest path to every editor.
   **Rejected:** violates the project's standing no-MCP decision (ADR 0001 — token bloat, and the
   control model is the product, not a tool other agents host). The user reaffirmed "no MCP."
2. **Native adapters over a portable core (chosen).** A standalone CLI + Copilot plugin + Action.
   More work per client, but no MCP dependency, no context bloat, full control of the loop. Honors
   the thesis.
3. **Copilot-CLI-only (status quo).** Keep it a repo + experimental extension. **Rejected:** not a
   "deliverable" — no install story, single host.

## Consequences

- The portable, SDK-free core is the durable asset; every adapter is thin and replaceable.
- v1 ships as an installable **CLI** (npm) + a **Copilot plugin** + a **GitHub Action**; surfaces
  covered are web (Chrome channel), Electron, and OpenFin (see the roadmap's v1 definition).
- **No MCP** anywhere — no `@playwright/mcp`, no qa-focus MCP server, ever. IDE/editor embedding is
  a non-goal; qa-focus is a CLI/CI tool.
- The `@github/copilot-sdk` seam stays narrow (harness + the plugin's `joinSession`); the CLI
  package depends on it, the core does not.
- Packaging implies a published, typed package — see [ADR 0004](0004-typescript-core-and-npm-package.md).
