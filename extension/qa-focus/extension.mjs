// qa-focus — Copilot CLI extension.
//
// Drop this directory into a repo's `.github/extensions/` (project-scoped) or
// the user's copilot extensions dir (machine-scoped). Every `copilot` session
// then gains two standards-enforcing tools and an always-on standards reminder:
//
//   • inspect_aom({ url?, region? })   — the accessibility tree of a live page
//   • propose_locator({ tier, ... })   — graded against the live page by the
//     priority ladder (focus-probe/qa-focus/ladder.mjs). Lazy CSS is bounced
//     toward role or a scoped accessible locator; genuine no-handle elements
//     degrade to CSS only with a reason, logged as accessibility debt.
//
// Unlike the standalone harness (prove.mjs), an extension JOINS the user's
// session, so it cannot remove built-in tools — this is the lighter, always-on
// leash: it makes the compliant path available and reminds every turn, rather
// than caging the model. Use the standalone harness for hard-gated CI runs.
//
// Requires `@playwright/test` resolvable from where this extension lives (a
// Playwright e2e repo already has it). `@github/copilot-sdk` is auto-injected.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { joinSession } from '@github/copilot-sdk/extension';
import { chromium } from '@playwright/test';
import { gradeLocator, render } from './ladder.mjs';

const STATE = join(tmpdir(), 'qa-focus-state.json');
const STANDARDS =
  'PLAYWRIGHT LOCATOR STANDARDS (always on): use the priority ladder ' +
  'role > label > placeholder > text > altText > title > testid > scoped (accessible parent + child) > css/xpath. ' +
  'Never hand-write CSS/XPath when an accessible locator works. Disambiguate non-unique names by scoping to an ' +
  'accessible ancestor (e.g. a table row) BEFORE using css. No hard sleeps; use web-first assertions.';

const load = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { facts: [], debt: [] });
const save = (s) => writeFileSync(STATE, JSON.stringify(s, null, 2));

let browser, page, currentUrl;
async function ensurePage(url) {
  if (!browser) { browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chromium' }); page = await browser.newPage(); }
  if (url && url !== currentUrl) { await page.goto(url, { waitUntil: 'domcontentloaded' }); currentUrl = url; }
  if (!currentUrl) throw new Error('no page loaded yet — call inspect_aom with a url first');
  return page;
}

const session = await joinSession({
  tools: [
    {
      name: 'inspect_aom',
      description: 'Load a URL (once) and return the accessibility tree (roles + names) of the page or a CSS region. Call before proposing a locator.',
      parameters: { type: 'object', properties: { url: { type: 'string' }, region: { type: 'string' } } },
      skipPermission: true,
      handler: async (a) => {
        const p = await ensurePage(a?.url);
        return await p.locator(a?.region || 'body').ariaSnapshot();
      },
    },
    {
      name: 'propose_locator',
      description:
        'Propose ONE locator following the priority ladder. For non-unique accessible names, pass `scope` (an accessible ' +
        'parent such as a table row) plus the child role/name. css/xpath are last-resort and REQUIRE a "reason". ' +
        'Returns the validated Playwright expression to paste into a test, or a rejection telling you the better tier.',
      parameters: {
        type: 'object',
        required: ['tier'],
        properties: {
          tier: { enum: ['role', 'label', 'placeholder', 'text', 'altText', 'title', 'testid', 'css', 'xpath'] },
          intent: { type: 'string' }, role: { type: 'string' }, name: { type: 'string' },
          scope: { type: 'object', properties: { tier: { type: 'string' }, role: { type: 'string' }, name: { type: 'string' }, expression: { type: 'string' }, exact: { type: 'boolean' } } },
          expression: { type: 'string' }, exact: { type: 'boolean' }, reason: { type: 'string' },
        },
      },
      skipPermission: true,
      handler: async (p) => {
        const pg = await ensurePage();
        const v = await gradeLocator(pg, p);
        if (!v.ok) {
          const hint = v.suggestion ? ` Use ${v.suggestion}.` : v.suggestedTier ? ` Try tier "${v.suggestedTier}".` : '';
          return { textResultForLlm: `REJECTED: ${v.reason}.${hint}`, resultType: 'failure' };
        }
        const code = render(p);
        const s = load();
        s.facts.push(`"${p.intent || code}" → ${code} (${v.tier}${v.degraded ? ', DEBT' : ''}).`);
        if (v.debt) s.debt.push({ ...v.debt, code });
        save(s);
        return { textResultForLlm: `ACCEPTED at tier "${v.tier}". Use:\n${code}${v.degraded ? '\n(logged as accessibility debt — file a ticket to add an accessible handle)' : ''}`, resultType: 'success' };
      },
    },
  ],
  hooks: {
    // Always-on standards + accumulated facts, re-injected each turn.
    onUserPromptSubmitted: async () => {
      const facts = load().facts;
      const extra = facts.length ? `\nESTABLISHED THIS SESSION:\n- ${facts.slice(-12).join('\n- ')}` : '';
      return { additionalContext: STANDARDS + extra };
    },
  },
});

session.log?.('qa-focus extension loaded — standards-enforcing locator tools active.');
