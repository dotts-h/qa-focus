# CONVENTIONS.md — the qa-focus constitution

> The single living rulebook. State **what to do now**; the **why** lives in the
> linked ADR. Machine facts (commands, paths, thresholds) are exact and
> copy-pasteable. When a rule changes, change it *here* and let pointers follow.

## Doctrine (carry these everywhere)

1. **One fact, one home.** A decision's *why* lives in exactly one ADR; code comments
   state the *contract* tersely and point (`— ADR-NNNN`); the glossary owns domain
   terms. Duplication across layers is the main drift engine.
2. **Enforce with hooks, not memory.** A rule you must remember is a rule that fails.
   Encode each hard-won invariant as a deterministic check wired into CI (can't merge
   a violation) and the local lint gate (caught before push).
3. **Small, auditable diffs.** One tight change per PR. For a refactor that crosses a
   module boundary or a public seam, plan first and get the plan approved before editing.
4. **Verify outward-facing actions before firing.** Releases, published artifacts,
   anything hard to reverse — confirm the inputs and check the result; never fire blind.
5. **Test-first.** Write a failing test, then the smallest code to pass it. Every fixed
   bug gets a guard test so it cannot regress silently.

## Workflow

- Branch from `main`; never commit directly to `main`.
- **Verify the base before branching**: fetch, fast-forward, and confirm the remote tip
  is what you expect — a stale base must fail loud, not silent.
- Write a failing test first, then the smallest code to pass it. Keep changes small.
- Before pushing, run the gates locally: `npm run lint` and `npm test`.
- Self-review the diff before pushing; size the review to the diff.
- Open a PR; **CI must be green** before merge.
- Fold supporting docs (ADRs, regressions, glossary updates) into the **same** feature
  branch as the change that motivated them — never a separate docs-only PR.

## Quality gates

Exact commands CI enforces (keep this list in lockstep with the CI workflow):

- **Lint:** `npm run lint`
- **Test:** `npm test`
- **CI runs once per change.** Workflows trigger on `pull_request` (the open PR) and
  `push` to `main` (merge) — **never** list a feature branch under `push`,
  which doubles every run. `scripts/check-workflows.sh` guards this (quality recipe).

## Architecture rules

> Load-bearing invariants. Each one cites the ADR that owns its rationale. Add new
> invariants here as one-liners; record the why in `docs/adr/`.

- *(none yet — add the first invariant alongside its ADR)*

## Docs & comments — one fact, one home

- **ADR = the why.** Single-sourced rationale; a code comment states the contract
  tersely and cites it (`— ADR-NNNN`), never re-narrates it.
- **CONTEXT.md = the domain glossary.** Define a term once there; everything else
  uses it without re-defining.
- **Comments earn their place** by capturing what the code can't (intent, invariants,
  the non-obvious). Don't restate the code.

## Environment facts

> Exact, copy-pasteable facts about this repo's toolchain — fill in as discovered.

- Lint: `npm run lint` · Test: `npm test`
- **Browser channels** (`PW_CHANNEL`): the whole stack is channel-parameterised. Verified green on
  the bundled **chromium** (`PW_CHANNEL=chromium`, the default) and the **branded Chrome**
  (`PW_CHANNEL=chrome`; install with `npx playwright install chrome`). Target apps usually run in
  branded Chrome, so prefer `chrome` for live runs. Electron/OpenFin are separate surfaces (`SURFACE=`).
- *(add toolchain paths, required versions, and known sandbox quirks here)*

## Naming & style

- Branches: `feat/…`, `fix/…`, `docs/…` (kebab, scope-prefixed).
- Commit messages: imperative subject, conventional-commit prefix where it fits.
