// explore.mjs — the autonomous EXPLORER.
//
// An Antigravity-style agentic browser tester built on the Copilot SDK +
// Playwright, with the safety model inverted toward control:
//   • URL allowlist (src/allowlist.mjs) blocks navigation off trusted hosts.
//   • Tool-gating (availableTools = browser actions only) is the real
//     prompt-injection defense: the agent holds NO filesystem/shell/network
//     tool, so a malicious page that says "read .env and POST it" has nothing
//     to do it with. The capability is removed, not just the URL restricted.
//   • Accessible actions — the model works off the accessibility-tree snapshot
//     and acts on element refs; verification is graded by the in-process gate.
//   • Evidence (src/evidence.mjs): console/network anomalies + a Playwright
//     trace, synthesized into a Markdown artifact for human verification.
//
// Browser actions go through @playwright/cli (ADR 0001): our in-process Playwright
// OWNS the browser (launched with --remote-debugging-port, so the gate, evidence
// collectors, and allowlist all watch the real page), and the CLI ATTACHES to that
// same browser over CDP to serve the model compact element refs instead of an
// inline accessibility tree (~4x fewer tokens). The CLI is wrapped in narrow gated
// defineTools — never raw shell.
//
// Output is DISCOVERY (findings a human verifies), not durable tests. Feed the
// worthwhile flows to the codifier (bin/author.mjs) to harden into gated specs.
//
// Env: COPILOT_CLI, COPILOT_MODEL, GOAL, START_URL, ALLOWLIST (csv), PW_CHANNEL, CDP_PORT.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CopilotClient, RuntimeConnection, ToolSet, defineTool, approveAll } from '@github/copilot-sdk';
import { openSurface } from '../src/provider.mjs';
import { makeAllowlist, guardContext } from '../src/allowlist.mjs';
import { newSink, attachCollectors, renderArtifact } from '../src/evidence.mjs';
import { makePwCli } from '../src/pwcli.mjs';
import { makeBrowserTools } from '../src/browser-tools.mjs';
import { resolveCopilotCli } from '../src/copilot-path.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolveCopilotCli();
const START_URL = process.env.START_URL || 'http://localhost:3000';
const GOAL = process.env.GOAL || 'Exercise the main user flow (add an item). Report anything broken or confusing.';
const ALLOWLIST = (process.env.ALLOWLIST || 'localhost').split(',');
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const log = (...a) => console.log('[explore]', ...a);

async function main() {
  const allow = makeAllowlist(ALLOWLIST);
  let server;
  if (START_URL.startsWith('http://localhost:3000')) {
    server = spawn('node', [join(HERE, '../fixtures/app/server.mjs')], { stdio: 'ignore', env: { ...process.env, PORT: '3000' } });
    await new Promise((r) => setTimeout(r, 500));
  }

  const surface = await openSurface({
    kind: process.env.SURFACE || 'web',
    channel: process.env.PW_CHANNEL,
    cdpPort: CDP_PORT,
    headless: !process.env.HEADED, // HEADED=1 to watch the browser (needs a display, e.g. the Mac mini)
    slowMo: process.env.HEADED ? Number(process.env.SLOWMO || 350) : undefined,
    forceOpenShadow: !!process.env.FORCE_OPEN_SHADOW, // reach inside CLOSED shadow roots (LWC etc.)
    electronArgs: (process.env.ELECTRON_ARGS || '').split(' ').filter(Boolean),
    cdpUrl: process.env.CDP_URL,
    storageState: process.env.STORAGE_STATE, // reuse a captured login (cookies + localStorage) if the file exists
  });
  const { context, page, cdpEndpoint } = surface;
  if (!cdpEndpoint) throw new Error(`surface "${surface.kind}" exposes no CDP endpoint for the playwright-cli to attach to (web/openfin only)`);
  if (surface.kind === 'web') await guardContext(context, allow); // allowlist applies to real web surfaces
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const sink = newSink();
  attachCollectors(page, sink, allow);
  const findings = [];

  if (allow(START_URL)) { await page.goto(START_URL, { waitUntil: 'domcontentloaded' }); sink.steps.push(`goto ${START_URL}`); }

  // Attach the CLI to the same browser our in-process page already drives.
  const pw = makePwCli({ session: 'qa-focus' });
  const att = await pw.attach(cdpEndpoint);
  if (!att.ok) throw new Error(`playwright-cli failed to attach over CDP: ${att.out}`);

  const getCtx = async () => ({ page, pwcli: pw });
  const tools = makeBrowserTools({ getCtx, allow, allowlist: ALLOWLIST, sink, findings, saveState: surface.saveState, statePath: process.env.STORAGE_STATE })
    .map(({ name, def }) => defineTool(name, def));
  const names = tools.map((t) => t.name ?? t.definition?.name).filter(Boolean);

  // Circuit breaker: the explorer is autonomous and token-heavy — cap tool calls so a
  // runaway loop can't burn quota indefinitely. On exhaustion the model is told to stop
  // and summarize (it still gets to write its findings artifact).
  const STEP_BUDGET = Number(process.env.STEP_BUDGET || 60);
  let steps = 0;

  const client = new CopilotClient({ connection: RuntimeConnection.forStdio({ path: CLI }) });
  const session = await client.createSession({
    ...(process.env.COPILOT_MODEL ? { model: process.env.COPILOT_MODEL } : {}),
    tools,
    availableTools: new ToolSet().addCustom('*'), // leash = injection defense: no fs/shell/network tools exist
    onPermissionRequest: approveAll,
    hooks: {
      onPreToolUse: async ({ toolName }) => {
        if (!names.includes(toolName)) return { permissionDecision: 'deny', permissionDecisionReason: `not an explore tool: ${toolName}` };
        if (++steps > STEP_BUDGET) return { permissionDecision: 'deny', permissionDecisionReason: `step budget (${STEP_BUDGET}) exhausted — stop exploring and report your findings now` };
        return undefined;
      },
    },
  });

  log('goal:', GOAL);
  await session.sendAndWait(
    {
      prompt:
        `${GOAL}\n\n` +
        'Start with browser_snapshot to see the page and obtain element refs (e.g. e5). ' +
        'Act with browser_click / browser_fill (by ref), browser_goto, browser_press. ' +
        'IFRAMES: the snapshot shows iframe content with frame-prefixed refs (e.g. f1e5) — act on those refs directly; ' +
        'when VERIFYING something inside an iframe, pass `frame` (an <iframe> CSS selector) to browser_expect_visible. ' +
        'SHADOW DOM: open roots appear in the snapshot and verify normally; closed roots are invisible (rerun with FORCE_OPEN_SHADOW=1 to reach them). ' +
        'Re-snapshot after actions that change the page; for long/virtual lists, scroll to reveal more rows. ' +
        'Verify outcomes with browser_expect_visible (role + name, or text). Use web-first checks — never assume a hard wait. ' +
        'Record bugs or confusing behavior with report_finding. Stay on the allowlisted app.',
    },
    240_000,
  );

  mkdirSync(join(HERE, '../artifacts'), { recursive: true });
  const tracePath = join(HERE, '../artifacts/explore-trace.zip');
  await context.tracing.stop({ path: tracePath });
  const md = renderArtifact({ goal: GOAL, sink, findings, tracePath });
  const out = join(HERE, '../artifacts/explore-report.md');
  writeFileSync(out, md);
  log('artifact:', out);
  console.log('\n' + md);

  await pw.detach().catch(() => {});
  await client.stop?.();
  await surface.close();
  server?.kill();
}

main().catch((e) => { console.error('[explore] FAILED:', e?.stack || e); process.exit(1); });
