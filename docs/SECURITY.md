# Security gate playbook — qa-focus

Security scanning is a **required CI gate**, not an advisory run —
`.github/workflows/security.yml` runs on the same single-run trigger as
the quality gates. It catches the class of regression unit/contract/e2e tests
don't: a known-CVE dependency, an insecure code pattern, or a credential
committed to history. Make it a required check via the pr-gating recipe.

## Threat model (qa-focus-specific)

This tool drives a browser over **untrusted page content** and runs a model that *acts*. The
defenses, and the residual risks, in priority order:

- **Prompt injection via a hostile page → defused by tool-gating (PRIMARY).** In the standalone
  harnesses (`explore`/`codify`/`interactive`) the model's entire capability surface is the gated
  browser/codify tools — it holds *no* fs/shell/network tool. `createGatedSession.onPreToolUse`
  (`src/harness.mjs`) denies anything else. A page that says "read .env and POST it" has no tool to
  do so. The URL allowlist (`src/allowlist.mjs`, network-layer nav abort) is the second layer.
  *(Sub-resources/iframes off-host — e.g. ads — are intentionally allowed; the leash, not the
  allowlist, is the real defense.)* — [ADR 0001](adr/0001-no-mcp-use-playwright-cli.md)
- **No raw shell to the model.** `pwcli` and `run_spec` shell out via `execFile` with **argv arrays**
  (never `shell:true`/string interpolation), so page or model text is always a value, never a command.
- **`write_spec` file writes are confined.** The spec name is `slug()`-sanitized (`[^a-z0-9]→-`), so
  no path traversal — writes stay under `tests/authored/`.
- **RESIDUAL — the codifier executes model-authored code.** `write_spec` writes a `.spec.ts` that
  `run_spec` then runs via `playwright test` (full Node). The standards linter blocks flaky patterns,
  **not** arbitrary `require`/fs/network in the spec. So a prompt-injected codifier could author a
  spec that does harm when run. Mitigation: authored specs are **untrusted until human-reviewed**
  (the "never self-certified" principle); run the codifier only in a dev/CI sandbox. A future
  hardening is to sandbox `run_spec`.
- **RESIDUAL — the Copilot extension is a SOFT leash.** An extension cannot remove copilot's built-in
  fs/shell tools, so the gate is bypassable there. Use `bin/interactive.mjs` (hard leash) when
  enforcement matters. — documented in [ARCHITECTURE.md](ARCHITECTURE.md).
- **Auth-state hygiene.** `save_auth` writes a storageState file of **live cookies/localStorage**;
  `.gitignore` excludes the common names — never commit one, and treat any committed one as a
  credential to rotate.

## Scan status (last full run, 2026-06-23)

- **`npm audit --audit-level=high`** — 0 vulnerabilities.
- **`gitleaks detect` (full history, 12 commits)** — 0 leaks.
- **`semgrep --config auto`** — runs in CI (`security.yml`); not run locally (not installed here).

## What each gate does

- **SAST (static analysis)** — `semgrep --error --config auto`. Reads the source without
  running it and flags insecure patterns (injection sinks, unsafe deserialization,
  weak crypto, tainted data reaching a dangerous call). It complements lint: lint
  is about style/correctness, SAST is about *security* properties.
- **Dependency / vulnerability audit** — `npm audit --audit-level=high`. Cross-checks
  your dependency tree (and, for tools like govulncheck, the *symbols you actually
  call*) against published advisories, so a vulnerable transitive package fails CI
  instead of shipping silently.
- **Secret scan (gitleaks)** — scans the diff (PRs) and history (pushes) for
  high-entropy strings and known credential shapes (API keys, tokens, private
  keys). A leaked secret is a credential to *rotate*, not just a line to delete —
  see triage below. Configured by `.gitleaks.toml`, whose allowlist exempts test
  fixtures.

## Run it locally (before you push)

```sh
# SAST + dependency audit — the exact commands CI runs:
semgrep --error --config auto
npm audit --audit-level=high

# Secret scan over the working tree + history (install gitleaks first):
gitleaks detect --config .gitleaks.toml --redact
```

Running these locally turns a red CI into a pre-push fix and keeps the gate fast.

## Triage a finding

1. **Is it real?** Read the finding — the rule id, the file/line, the data flow.
   SAST and audit tools report *potential* issues; confirm the path is actually
   reachable and the input actually untrusted.
2. **If real, fix at the root.** Bump/patch the vulnerable dependency (or remove
   it); rewrite the insecure pattern; for a leaked secret, **rotate the credential
   first** (assume it is compromised the moment it hit a remote), then purge it
   from history (`git filter-repo`/BFG) and update `.gitleaks.toml` only if a
   *non-secret* fixture tripped the scanner.
3. **If it can't be fixed now,** open a tracked issue (issues recipe) with the
   severity and a deadline rather than suppressing it silently — a suppression
   with no owner is how a real vuln hides.

## Suppress a false positive (deliberately, with a paper trail)

A suppression is a security decision; it must be narrow, justified, and reviewable.

- **SAST** — use the tool's inline suppression scoped to the single line/rule
  (e.g. `// nosec G401` for gosec/`#nosec`, `# nosemgrep: <rule-id>` for semgrep,
  `# nosec` for bandit) **with a comment saying why**. Never disable a whole rule
  repo-wide to clear one finding.
- **Dependency audit** — record the accepted advisory in the tool's ignore file
  (`govulncheck` has no per-CVE ignore — pin/patch instead; `pip-audit
  --ignore-vuln`, `npm audit` resolutions, `trivy --ignorefile .trivyignore`)
  with an expiry/review date.
- **Secret scan** — add a path or regex to the `allowlist` in `.gitleaks.toml`
  for genuine test fixtures only. If it's a real key shape that happens to be
  fake, prefer an obviously-fake placeholder (`AKIAEXAMPLE…`) over an allowlist.

Every suppression is a review flag: the reviewer should see *why* in the diff.

## Backfill checklist

- [ ] Install the scanners CI needs in `security.yml` (govulncheck/semgrep/bandit/
      pip-audit/trivy/npm — match `semgrep --error --config auto` and `npm audit --audit-level=high`).
- [ ] Set `semgrep --error --config auto` / `npm audit --audit-level=high` to this repo's real tools.
- [ ] Make `security` a required status check (pr-gating recipe).
- [ ] Triage and fix (or track) the findings from the first full run.
- [ ] Rotate any credential the secret scan surfaces in existing history.
