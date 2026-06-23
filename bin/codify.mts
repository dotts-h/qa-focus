// codify.mts — the autonomous CODIFIER (the second half of the thesis).
//
// Where bin/explore.mts DISCOVERS flows (throwaway evidence a human reads), this
// HARDENS one named flow into a durable, standards-compliant Playwright spec under
// tests/authored/, verified by the real `playwright test` gate. Same control model
// as the explorer: the model holds ONLY gated tools (browser_* + propose_locator /
// write_spec / run_spec) — no fs/shell/network — so it cannot route around the gate.
//
// The loop the model is asked to run, autonomously:
//   1. drive the flow with browser_* (goto/snapshot/click/fill), verifying each step,
//   2. propose_locator for every element it will assert on (graded by the ladder),
//   3. write_spec — full .spec.ts source, REJECTED if it breaks the standards linter,
//   4. run_spec — the authored test runs under real Playwright; iterate until green.
//
// Env: COPILOT_CLI, COPILOT_MODEL, GOAL, START_URL, ALLOWLIST (csv), SPEC_NAME,
//      PW_CHANNEL, CDP_PORT, STEP_BUDGET, HEADED, SURFACE, CDP_URL, FORCE_OPEN_SHADOW.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createGatedSession } from '../src/harness.mjs';
import { isFlow, flowToSeed } from '../src/flow.mjs';
import type { Flow } from '../src/flow.mjs';
import { openSurface } from '../src/provider.mjs';
import { makeAllowlist, guardContext } from '../src/allowlist.mjs';
import { newSink, attachCollectors } from '../src/evidence.mjs';
import type { Finding } from '../src/evidence.mjs';
import { attachCli } from '../src/pwcli.mjs';
import { attachInProcess } from '../src/inproc-driver.mjs';
import { makeBrowserTools } from '../src/browser-tools.mjs';
import { makeCodifyTools } from '../src/codify-tools.mjs';
import { resolveCopilotCli } from '../src/copilot-path.mjs';
import { STANDARDS_PROMPT, specShapeInstruction } from '../src/standards.mjs';
import { renderCostSummary } from '../src/cost.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// The codifier writes specs and runs the `playwright test` gate in the USER's project (their
// playwright.config, their tests/authored), so ROOT is the invocation cwd — NOT join(HERE,'..'),
// which is the package's own dist/ when installed (no config there). In dev (run from the repo
// root) process.cwd() IS the repo root, so behavior is unchanged.
const ROOT = process.cwd();
const CLI = resolveCopilotCli();
// M4 handoff: FLOW=path/to/explore-flow.json seeds the codifier with the explorer's
// discovered recipe (steps + start URL + goal). It's a SEED to re-walk and gate-harden,
// never trusted output — the gate still grades every locator live.
const FLOW: Flow | null = process.env.FLOW ? JSON.parse(readFileSync(process.env.FLOW, 'utf8')) : null;
if (process.env.FLOW && !isFlow(FLOW)) throw new Error(`FLOW file ${process.env.FLOW} is not a valid flow (no steps[])`);
const START_URL = process.env.START_URL || FLOW?.startUrl || 'http://localhost:3000';
const GOAL = process.env.GOAL || FLOW?.goal || 'Harden the main add-to-cart flow into a durable Playwright test.';
const SPEC_NAME = process.env.SPEC_NAME || 'authored-flow';
const ALLOWLIST = (process.env.ALLOWLIST || 'localhost').split(',');
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const SURFACE = process.env.SURFACE || 'web';
// Electron launch args (app DIRECTORY + flags), as for the explorer. The app path (first
// non-flag token) seeds the Electron-executing authored spec's `_electron.launch` (#0027, ADR 0011).
const ELECTRON_ARGS = (process.env.ELECTRON_ARGS || '').split(' ').filter(Boolean);
const ELECTRON_APP = ELECTRON_ARGS.find((a) => !a.startsWith('-')) || 'fixtures/electron';
// Live run stream is default-on; silence it for piped/CI runs (#0013).
const QUIET = !!process.env.QA_QUIET || process.argv.includes('--quiet');
// Optional credits→$ rate (USD per AI-Credit) for the cost summary's $ estimate (#0014).
const AIU_USD = Number(process.env.QA_AIU_USD) || undefined;
const log = (...a: unknown[]): void => console.log('[codify]', ...a);

async function main(): Promise<void> {
  const allow = makeAllowlist(ALLOWLIST);

  // The Electron-executing authored spec reads QA_ELECTRON_APP (allowlisted through safeSpecEnv) to
  // know which app to launch; bake it from ELECTRON_ARGS so run_spec resolves it (the spec also
  // carries the path as a literal fallback). Don't clobber an explicit override.
  if (SURFACE === 'electron' && !process.env.QA_ELECTRON_APP) process.env.QA_ELECTRON_APP = ELECTRON_APP;

  const surface = await openSurface({
    kind: SURFACE,
    electronArgs: ELECTRON_ARGS,
    channel: process.env.PW_CHANNEL,
    cdpPort: CDP_PORT,
    headless: !process.env.HEADED,
    slowMo: process.env.HEADED ? Number(process.env.SLOWMO || 350) : undefined,
    forceOpenShadow: !!process.env.FORCE_OPEN_SHADOW,
    cdpUrl: process.env.CDP_URL,
    storageState: process.env.STORAGE_STATE, // reuse a captured login if the file exists
  });
  const { context, page, cdpEndpoint } = surface;
  // Electron has no CDP endpoint → in-process action driver (ADR 0005); web/openfin need CDP.
  if (!cdpEndpoint && surface.kind !== 'electron') throw new Error(`surface "${surface.kind}" exposes no CDP endpoint for the playwright-cli to attach to`);
  if (surface.kind === 'web') await guardContext(context, allow);
  const sink = newSink();
  attachCollectors(page, sink, allow);
  const findings: Finding[] = [];
  const facts: string[] = [];

  // Electron loads its own app; only web/openfin start from START_URL (see bin/explore.mts).
  if (surface.kind !== 'electron' && allow(START_URL)) { await page.goto(START_URL, { waitUntil: 'domcontentloaded' }); sink.steps.push(`goto ${START_URL}`); }

  const { pwcli: pw, getCtx } = cdpEndpoint
    ? await attachCli({ cdpEndpoint, page, session: 'qa-focus-codify' })
    : await attachInProcess({ page, session: 'qa-focus-codify' });

  // The control model (hard leash + step budget + recency) lives in src/harness.mts (ADR 0002).
  const { session, client, detachStream, getUsage } = await createGatedSession({
    cli: CLI,
    model: process.env.COPILOT_MODEL,
    quiet: QUIET, // stream the model's reasoning/output/tool calls live unless silenced (#0013)
    tools: [
      ...makeBrowserTools({ getCtx, allow, allowlist: ALLOWLIST, sink, findings, saveState: surface.saveState, statePath: process.env.STORAGE_STATE }),
      ...makeCodifyTools({ getCtx, root: ROOT, facts }),
    ],
    stepBudget: Number(process.env.STEP_BUDGET || 80), // codifying is multi-turn and token-heavy
    recency: async () => {
      const extra = facts.length ? `\nGATE-ACCEPTED LOCATORS THIS SESSION (reuse verbatim in the spec):\n- ${facts.slice(-16).join('\n- ')}` : '';
      return { additionalContext: STANDARDS_PROMPT + extra };
    },
  });

  log('goal:', GOAL, '| spec:', SPEC_NAME, FLOW ? `| seeded from FLOW (${FLOW.steps.length} steps)` : '');
  const seed = FLOW ? flowToSeed(FLOW) + '\n\n' : '';
  const res = await session.sendAndWait(
    {
      prompt:
        seed +
        `${GOAL}\n\n` +
        `Produce a durable Playwright test named "${SPEC_NAME}". Work in this order:\n` +
        '1. WALK the flow first with browser_snapshot + browser_click / browser_fill / browser_goto, ' +
        'verifying each outcome with browser_expect_visible so you know the real steps and the real on-screen text. ' +
        'If a cookie/consent overlay blocks actions, call dismiss_consent — and include the SAME dismissal at the ' +
        'top of the authored spec (a tolerant best-effort click) so the durable test is robust to it.\n' +
        '2. For every element the test will act on or assert, call propose_locator — use the EXACT Playwright ' +
        'expression it returns back (it is gate-graded; a rejection names the better tier — follow it).\n' +
        `3. ${specShapeInstruction(SURFACE, { appPath: ELECTRON_APP })}\n` +
        '4. Call run_spec. If it FAILS, read the output, fix the spec (or re-propose locators on the live page), and run_spec again until it PASSES.\n' +
        'Stay on the allowlisted app. Finish by reporting the authored spec path and the final run result.',
    },
    600_000, // the full walk→propose→write→run→fix loop needs more than 5 min on a real app
  );
  detachStream(); // close the live stream before the summary prints

  const r: any = res;
  const text = typeof r === 'string' ? r : r?.text ?? r?.content ?? r?.data?.content ?? '';
  // When streaming (not quiet) the final answer already rendered live — don't reprint it or a
  // bodyless "model summary" header; only the quiet/piped path needs the summary text in stdout.
  if (text && QUIET) { log('--- model summary ---'); console.log(text); }
  log('accepted locators:', facts.length);
  for (const f of facts) console.log('  •', f);
  console.log('\n' + renderCostSummary(getUsage({ creditsToUsd: AIU_USD }))); // what the run cost (#0014)

  await pw.detach().catch(() => {});
  await client.stop?.();
  await surface.close();
}

main().catch((e) => { console.error('[codify] FAILED:', e?.stack || e); process.exit(1); });
