// codify.mjs — the autonomous CODIFIER (the second half of the thesis).
//
// Where bin/explore.mjs DISCOVERS flows (throwaway evidence a human reads), this
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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CopilotClient, RuntimeConnection, ToolSet, defineTool, approveAll } from '@github/copilot-sdk';
import { openSurface } from '../src/provider.mjs';
import { makeAllowlist, guardContext } from '../src/allowlist.mjs';
import { newSink, attachCollectors } from '../src/evidence.mjs';
import { makePwCli } from '../src/pwcli.mjs';
import { makeBrowserTools } from '../src/browser-tools.mjs';
import { makeCodifyTools } from '../src/codify-tools.mjs';
import { resolveCopilotCli } from '../src/copilot-path.mjs';
import { STANDARDS_PROMPT } from '../src/standards.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CLI = resolveCopilotCli();
const START_URL = process.env.START_URL || 'http://localhost:3000';
const GOAL = process.env.GOAL || 'Harden the main add-to-cart flow into a durable Playwright test.';
const SPEC_NAME = process.env.SPEC_NAME || 'authored-flow';
const ALLOWLIST = (process.env.ALLOWLIST || 'localhost').split(',');
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const log = (...a) => console.log('[codify]', ...a);

async function main() {
  const allow = makeAllowlist(ALLOWLIST);

  const surface = await openSurface({
    kind: process.env.SURFACE || 'web',
    channel: process.env.PW_CHANNEL,
    cdpPort: CDP_PORT,
    headless: !process.env.HEADED,
    slowMo: process.env.HEADED ? Number(process.env.SLOWMO || 350) : undefined,
    forceOpenShadow: !!process.env.FORCE_OPEN_SHADOW,
    cdpUrl: process.env.CDP_URL,
    storageState: process.env.STORAGE_STATE, // reuse a captured login if the file exists
  });
  const { context, page, cdpEndpoint } = surface;
  if (!cdpEndpoint) throw new Error(`surface "${surface.kind}" exposes no CDP endpoint for the playwright-cli to attach to`);
  if (surface.kind === 'web') await guardContext(context, allow);
  const sink = newSink();
  attachCollectors(page, sink, allow);
  const findings = [];
  const facts = [];

  if (allow(START_URL)) { await page.goto(START_URL, { waitUntil: 'domcontentloaded' }); sink.steps.push(`goto ${START_URL}`); }

  const pw = makePwCli({ session: 'qa-focus-codify' });
  const att = await pw.attach(cdpEndpoint);
  if (!att.ok) throw new Error(`playwright-cli failed to attach over CDP: ${att.out}`);
  const getCtx = async () => ({ page, pwcli: pw });

  const tools = [
    ...makeBrowserTools({ getCtx, allow, allowlist: ALLOWLIST, sink, findings, saveState: surface.saveState, statePath: process.env.STORAGE_STATE }),
    ...makeCodifyTools({ getCtx, root: ROOT, facts }),
  ].map(({ name, def }) => defineTool(name, def));
  const names = tools.map((t) => t.name ?? t.definition?.name).filter(Boolean);

  // Circuit breaker — codifying is multi-turn and token-heavy; cap tool calls.
  const STEP_BUDGET = Number(process.env.STEP_BUDGET || 80);
  let steps = 0;

  const client = new CopilotClient({ connection: RuntimeConnection.forStdio({ path: CLI }) });
  const session = await client.createSession({
    ...(process.env.COPILOT_MODEL ? { model: process.env.COPILOT_MODEL } : {}),
    tools,
    availableTools: new ToolSet().addCustom('*'), // HARD leash: only our tools exist
    onPermissionRequest: approveAll,
    hooks: {
      onUserPromptSubmitted: async () => {
        const extra = facts.length ? `\nGATE-ACCEPTED LOCATORS THIS SESSION (reuse verbatim in the spec):\n- ${facts.slice(-16).join('\n- ')}` : '';
        return { additionalContext: STANDARDS_PROMPT + extra };
      },
      onPreToolUse: async ({ toolName }) => {
        if (!names.includes(toolName)) return { permissionDecision: 'deny', permissionDecisionReason: `not a qa-focus tool: ${toolName}` };
        if (++steps > STEP_BUDGET) return { permissionDecision: 'deny', permissionDecisionReason: `step budget (${STEP_BUDGET}) exhausted — finish the spec and run_spec now` };
        return undefined;
      },
    },
  });

  log('goal:', GOAL, '| spec:', SPEC_NAME);
  const res = await session.sendAndWait(
    {
      prompt:
        `${GOAL}\n\n` +
        `Produce a durable Playwright test named "${SPEC_NAME}". Work in this order:\n` +
        '1. WALK the flow first with browser_snapshot + browser_click / browser_fill / browser_goto, ' +
        'verifying each outcome with browser_expect_visible so you know the real steps and the real on-screen text. ' +
        'If a cookie/consent overlay blocks actions, call dismiss_consent — and include the SAME dismissal at the ' +
        'top of the authored spec (a tolerant best-effort click) so the durable test is robust to it.\n' +
        '2. For every element the test will act on or assert, call propose_locator — use the EXACT Playwright ' +
        'expression it returns back (it is gate-graded; a rejection names the better tier — follow it).\n' +
        '3. Call write_spec with the FULL .spec.ts source: a single test(), import { test, expect } from "@playwright/test", ' +
        'navigate by full URL, web-first assertions only (await expect(locator).toBeVisible()), NO hard waits, NO networkidle, ' +
        'NO raw element handles, NO XPath. Reuse the gate-accepted locator expressions verbatim.\n' +
        '4. Call run_spec. If it FAILS, read the output, fix the spec (or re-propose locators on the live page), and run_spec again until it PASSES.\n' +
        'Stay on the allowlisted app. Finish by reporting the authored spec path and the final run result.',
    },
    600_000, // the full walk→propose→write→run→fix loop needs more than 5 min on a real app
  );

  const text = typeof res === 'string' ? res : res?.text ?? res?.content ?? '';
  log('--- model summary ---');
  if (text) console.log(text);
  log('accepted locators:', facts.length);
  for (const f of facts) console.log('  •', f);

  await pw.detach().catch(() => {});
  await client.stop?.();
  await surface.close();
}

main().catch((e) => { console.error('[codify] FAILED:', e?.stack || e); process.exit(1); });
