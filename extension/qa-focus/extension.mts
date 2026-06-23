// qa-focus — Copilot CLI extension (the INTERACTIVE front door).
//
// Drop this directory into a repo's `.github/extensions/` (project-scoped) or the
// user's copilot extensions dir (machine-scoped), then run `copilot` inside the
// qa-focus repo. Your interactive session gains the full drive → explore → harden
// loop against ONE live browser:
//
//   • browser_* (snapshot/goto/click/fill/press/expect_visible) — the same gated,
//     CLI-ref-backed browser tools the autonomous explorer uses (src/browser-tools.mts),
//     so you can say "log in and stop", then "now explore the cart", turn by turn.
//   • propose_locator — grade a locator against the CURRENT live page by the priority
//     ladder (ladder.mts); lazy CSS is bounced toward role/scoped, no-handle elements
//     degrade to CSS only with a reason (logged as accessibility debt).
//   • write_spec / run_spec — codify a hardened flow into a Playwright test file and
//     run it through the real gate (playwright test). "Verify on a real signal."
//
// Unlike the standalone harness (bin/explore.mts), an extension JOINS your session,
// so it CANNOT remove copilot's built-in tools — the leash here is human-in-the-loop
// approval (you see/approve each turn), not tool-caging. Use the standalone harness
// for unattended/CI runs where the hard injection-defense leash matters.
//
// Env: QA_ALLOWLIST (csv, default "localhost"), CDP_PORT (default 9222),
//      HEADED=1 to watch the browser, SLOWMO (ms, headed), PW_CHANNEL.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { joinSession } from '@github/copilot-sdk/extension';
import type { Page } from 'playwright';
import { openSurface } from '../../src/provider.mjs';
import type { Surface } from '../../src/provider.mjs';
import { makeAllowlist, guardContext } from '../../src/allowlist.mjs';
import { attachCli } from '../../src/pwcli.mjs';
import type { PwCli, BrowserCtx } from '../../src/pwcli.mjs';
import { makeBrowserTools } from '../../src/browser-tools.mjs';
import { makeCodifyTools } from '../../src/codify-tools.mjs';
import { STANDARDS_PROMPT } from '../../src/standards.mjs';
import type { Finding } from '../../src/evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..'); // project root (has playwright.config.ts, tests/)
const ALLOWLIST = (process.env.QA_ALLOWLIST || 'localhost').split(',');
const CDP_PORT = Number(process.env.CDP_PORT || 9222);

// One live browser for the whole session, opened LAZILY on first tool use (so the
// extension calls joinSession promptly and never blocks the load handshake). Our
// in-process Playwright owns it (gate + allowlist watch the real page); the CLI
// attaches over CDP as the action surface.
const allow = makeAllowlist(ALLOWLIST);
const findings: Finding[] = [];
const facts: string[] = []; // accepted-locator facts, re-injected each turn for recency
let driver: { surface: Surface; pw: PwCli; page: Page } | undefined; // { surface, pw, page }
async function getCtx(): Promise<BrowserCtx> {
  if (!driver) {
    const surface = await openSurface({
      kind: 'web',
      channel: process.env.PW_CHANNEL,
      cdpPort: CDP_PORT,
      headless: !process.env.HEADED,
      slowMo: process.env.HEADED ? Number(process.env.SLOWMO || 350) : undefined,
      forceOpenShadow: !!process.env.FORCE_OPEN_SHADOW,
    });
    await guardContext(surface.context, allow);
    const { pwcli } = await attachCli({ cdpEndpoint: surface.cdpEndpoint!, page: surface.page, session: 'qa-focus-ext' });
    driver = { surface, pw: pwcli, page: surface.page };
  }
  return { page: driver.page, pwcli: driver.pw };
}
const cleanup = (): void => { driver?.pw.detach().catch(() => {}); driver?.surface.close().catch(() => {}); };
for (const sig of ['SIGINT', 'SIGTERM', 'exit'] as const) process.on(sig, cleanup);

const browserTools = makeBrowserTools({ getCtx, allow, allowlist: ALLOWLIST, findings })
  .map(({ name, def }) => ({ name, ...def }));
const codifyTools = makeCodifyTools({ getCtx, root: ROOT, facts })
  .map(({ name, def }) => ({ name, ...def }));

const session = await joinSession({
  tools: [...browserTools, ...codifyTools],
  hooks: {
    onUserPromptSubmitted: async () => {
      // Don't tax UNRELATED turns: until the browser is actually engaged (driver opened on
      // first QA tool use, or facts/findings recorded), inject nothing. An always-loaded
      // extension that pushes its standards block on every prompt is the per-turn-cost
      // anti-pattern; the real fix is to load qa-focus opt-in, this caps the cost when it is.
      if (!driver && !facts.length && !findings.length) return undefined;
      const extra = facts.length ? `\nESTABLISHED THIS SESSION:\n- ${facts.slice(-12).join('\n- ')}` : '';
      const found = findings.length ? `\nFINDINGS SO FAR: ${findings.length} (use report_finding to add).` : '';
      return { additionalContext: STANDARDS_PROMPT + extra + found };
    },
  },
});

session.log?.(`qa-focus extension loaded — browser+gate+codify tools active (allowlist: ${ALLOWLIST.join(', ')}${process.env.HEADED ? ', HEADED' : ''}).`);
