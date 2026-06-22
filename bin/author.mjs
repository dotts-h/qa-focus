// Live, multi-turn proof of the focus harness against a REAL bad app
// (the-internet.herokuapp.com), using the INSTALLED copilot login.
//
// Demonstrates, end-to-end, all three pains solved:
//   • Tool-gating — the model has ONLY inspect_aom + propose_locator. It cannot
//     navigate, edit files, or shell out. The HARNESS owns navigation.
//   • Enforced ladder w/ graceful degradation — on /login it must climb to role;
//     on /challenging_dom flat role is rejected (not unique) and it must degrade
//     to a justified CSS locator, logged as accessibility debt.
//   • Recency — established facts live in state.json and are re-injected every
//     turn (you'll see "[harness] re-injecting N fact(s)" before each turn).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { CopilotClient, RuntimeConnection, ToolSet, defineTool, approveAll } from '@github/copilot-sdk';
import { gradeLocator } from '../extension/qa-focus/ladder.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, 'state.json');
const CLI = process.env.COPILOT_CLI || '/usr/local/bin/copilot';
const SITE = process.env.TARGET_URL || 'https://the-internet.herokuapp.com';

const load = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { facts: [], accepted: [], debt: [] });
const save = (s) => writeFileSync(STATE, JSON.stringify(s, null, 2));
const log = (...a) => console.log('[harness]', ...a);

function buildTools(page) {
  const inspect = defineTool('inspect_aom', {
    description: 'Return the accessibility tree (roles + names) of the page or a CSS region. Call this BEFORE proposing a locator.',
    parameters: { type: 'object', properties: { region: { type: 'string' } } },
    skipPermission: true,
    handler: async (a) => await page.locator(a?.region || 'body').ariaSnapshot(),
  });
  const propose = defineTool('propose_locator', {
    description:
      'Propose ONE locator. Priority: role > label > placeholder > text > altText > title > testid > scoped > css/xpath. ' +
      'If a flat accessible name is NOT unique (e.g. one "edit" link per table row), prefer a SCOPED accessible locator: ' +
      'pass `scope` (an accessible parent such as the table row, same shape as the child) and the child role/name. ' +
      'Only fall to css/xpath when no accessible handle exists at all — those REQUIRE a "reason" and are logged as debt. ' +
      'The gate checks the locator resolves to exactly one element and that no higher tier would work.',
    parameters: {
      type: 'object',
      required: ['tier', 'intent'],
      properties: {
        tier: { enum: ['role', 'label', 'placeholder', 'text', 'altText', 'title', 'testid', 'css', 'xpath'] },
        intent: { type: 'string' }, role: { type: 'string' }, name: { type: 'string' },
        scope: {
          type: 'object',
          description: 'optional accessible parent to scope within (e.g. the table row identified by a unique cell)',
          properties: { tier: { type: 'string' }, role: { type: 'string' }, name: { type: 'string' }, expression: { type: 'string' }, exact: { type: 'boolean' } },
        },
        expression: { type: 'string' }, exact: { type: 'boolean' }, reason: { type: 'string' },
      },
    },
    skipPermission: true,
    handler: async (p) => {
      const v = await gradeLocator(page, p);
      if (!v.ok) {
        const hint = v.suggestedTier ? ` Try tier "${v.suggestedTier}".` : '';
        log('  ✗ rejected', `[${p.tier}] ${p.intent}:`, v.reason);
        return { textResultForLlm: `REJECTED: ${v.reason}.${hint}`, resultType: 'failure' };
      }
      const s = load();
      s.accepted.push({ intent: p.intent, tier: v.tier, expression: p.expression, role: p.role, name: p.name });
      s.facts.push(`"${p.intent}" → tier ${v.tier}${v.degraded ? ' (degraded CSS, logged as debt — no accessible handle)' : ''}.`);
      if (v.debt) s.debt.push(v.debt);
      save(s);
      log('  ✓ accepted', `[${v.tier}]`, p.intent, v.degraded ? '(DEBT)' : '');
      return { textResultForLlm: `ACCEPTED at tier "${v.tier}".${v.degraded ? ' Logged as accessibility debt.' : ''}`, resultType: 'success' };
    },
  });
  return [inspect, propose];
}

async function turn(session, page, label, url, prompt) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  log(`── turn: ${label} → ${url}`);
  await session.sendAndWait({ prompt }, 150_000);
}

async function main() {
  save({ facts: [], accepted: [], debt: [] });
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chromium' });
  const page = await browser.newPage();
  const tools = buildTools(page);

  const client = new CopilotClient({ connection: RuntimeConnection.forStdio({ path: CLI }) });
  const session = await client.createSession({
    ...(process.env.COPILOT_MODEL ? { model: process.env.COPILOT_MODEL } : {}),
    tools,
    availableTools: new ToolSet().addCustom('*'), // leash: only our tools exist
    onPermissionRequest: approveAll,
    hooks: {
      onUserPromptSubmitted: async () => {
        const facts = load().facts;
        if (!facts.length) return undefined;
        log(`re-injecting ${facts.length} fact(s) into context`); // ← recency mechanism, visible
        return { additionalContext: `ESTABLISHED FACTS (always honor; do not re-propose locators already known to fail):\n- ${facts.join('\n- ')}` };
      },
      onPreToolUse: async ({ toolName }) =>
        ['inspect_aom', 'propose_locator'].includes(toolName)
          ? undefined
          : { permissionDecision: 'deny', permissionDecisionReason: `out of LOCATE phase: ${toolName}` },
    },
  });

  log('CLI:', CLI, '| site:', SITE);

  // Turn 1 — accessible page: the ladder should climb to role.
  await turn(session, page, 'login (good markup)', `${SITE}/login`,
    'Find resilient locators for the Username field, the Password field, and the Login button. Call inspect_aom first, then propose_locator for each.');

  // Turn 2 — hostile page: flat role is not unique; must degrade with a reason.
  await turn(session, page, 'challenging_dom edit (hostile)', `${SITE}/challenging_dom`,
    'Find a locator for the "edit" link in the FIRST row of the table. Inspect first.');

  // Turn 3 — recency: facts from turns 1–2 are re-injected; it should apply the
  // same row-scoping/degradation it learned for "edit" without re-trying flat role.
  await turn(session, page, 'challenging_dom delete (recency)', `${SITE}/challenging_dom`,
    'Now find a locator for the "delete" link in the FIRST row of the table.');

  const s = load();
  console.log('\n================ PROOF SUMMARY ================');
  console.log('ACCEPTED LOCATORS:'); for (const a of s.accepted) console.log(`  [${a.tier}] ${a.intent}${a.expression ? '  →  ' + a.expression : ''}`);
  console.log('ACCESSIBILITY DEBT (forced CSS/XPath, with reason):'); for (const d of s.debt) console.log(`  ${d.expression}  —  ${d.reason}`);
  console.log('===============================================');

  await client.stop?.();
  await browser.close();
}

main().catch((e) => { console.error('[harness] FAILED:', e?.stack || e); process.exit(1); });
