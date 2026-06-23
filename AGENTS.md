# AGENTS.md — qa-focus

Control-first agentic QA on the GitHub Copilot SDK + Playwright

This file is a **thin pointer**; the canonical rules live in the docs below — read
them before acting. One fact, one home: never copy a rule here, link it.

- **Conventions (the constitution):** [docs/CONVENTIONS.md](docs/CONVENTIONS.md) —
  workflow, doctrine, quality gates, environment facts.
- **Context (the glossary):** [docs/CONTEXT.md](docs/CONTEXT.md) — the ubiquitous
  language, defined once. Read it before naming a new type; add a term there before
  writing its code.
- **Decisions (why):** [docs/adr/](docs/adr/README.md) — one record per decision.

Quick gates (exact commands in CONVENTIONS): `npm run lint` and `npm test`
before push; CI must be green before merge. Branch from `main`; never
commit to it directly.
