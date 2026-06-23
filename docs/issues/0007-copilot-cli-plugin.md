---
id: 0007
title: Copilot CLI plugin packaging (plugin.json + git marketplace)
status: closed
severity: medium
group: 0001
depends_on: [0006]
github: 8
forgejo:
links:
  adr: 0003
  prs: []
  issues: []
  regression:
assets: []
---

## Summary
Package qa-focus as a native Copilot CLI **plugin** (`plugin.json`) distributable via the git-based
marketplace (`copilot plugin marketplace add OWNER/REPO`; `copilot plugin install`). Per ADR 0003 the
plugin contributes a **skill** (not the experimental JS extension) that teaches the Copilot CLI agent
to drive the git-installed qa-focus CLI — skills/agents/hooks only, **no MCP**.

## Acceptance
- [x] `plugin.json` manifest (`plugins/qa-focus/plugin.json`) + a `qa-focus` skill
      (`plugins/qa-focus/skills/qa-focus/SKILL.md`) + a git marketplace
      (`.github/plugin/marketplace.json`). Loads as an installed plugin — verified end-to-end with
      the real `copilot` binary: `marketplace add` → `install qa-focus@qa-focus` → "Installed 1
      skill" → listed in `copilot plugin list`. (Manifest schemas verified against the official
      `cli-plugin-reference` docs + the `copilot` binary.)
- [x] Install-from-git documented (README "GitHub Copilot CLI plugin"): `copilot plugin marketplace
      add dotts-h/qa-focus` + `copilot plugin install qa-focus@qa-focus`. (Direct path/URL installs
      are deprecated by the CLI in favour of `@marketplace` — so the marketplace flow is the one we
      ship.)
- [x] **No MCP server bundled** — no `mcpServers`/`lspServers` in the manifest, no `.mcp.json` in the
      plugin dir (ADR 0001/0003). Guarded deterministically by `tests/plugin.spec.ts` (5 cases:
      manifest validity, no-MCP, the skill exists with frontmatter, the marketplace points at the
      real plugin dir).

## Notes
Distinct from the npm CLI (#0006): this is the Copilot-CLI surface. The plugin contributes a skill
(per ADR 0003), not the experimental `extension/qa-focus/extension.mts` (that's a separate
experimental mechanism that would need `--experimental`); the skill drives the git-installed CLI.
