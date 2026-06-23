// explore.mts — the autonomous EXPLORER.
//
// An Antigravity-style agentic browser tester built on the Copilot SDK +
// Playwright, with the safety model inverted toward control:
//   • URL allowlist (src/allowlist.mts) blocks navigation off trusted hosts.
//   • Tool-gating (availableTools = browser actions only) is the real
//     prompt-injection defense: the agent holds NO filesystem/shell/network
//     tool, so a malicious page that says "read .env and POST it" has nothing
//     to do it with. The capability is removed, not just the URL restricted.
//   • Accessible actions — the model works off the accessibility-tree snapshot
//     and acts on element refs; verification is graded by the in-process gate.
//   • Evidence (src/evidence.mts): console/network anomalies + a Playwright
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
// worthwhile flows to the codifier (bin/codify.mts) to harden into gated specs.
//
// Env: COPILOT_CLI, COPILOT_MODEL, GOAL, START_URL, ALLOWLIST (csv), PW_CHANNEL, CDP_PORT.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createGatedSession } from '../src/harness.mjs';
import { openSurface } from '../src/provider.mjs';
import { makeAllowlist, guardContext } from '../src/allowlist.mjs';
import { newSink, attachCollectors, renderArtifact } from '../src/evidence.mjs';
import type { Finding } from '../src/evidence.mjs';
import { attachCli } from '../src/pwcli.mjs';
import { attachInProcess } from '../src/inproc-driver.mjs';
import { makeBrowserTools } from '../src/browser-tools.mjs';
import { resolveCopilotCli } from '../src/copilot-path.mjs';
import { newFlow } from '../src/flow.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolveCopilotCli();
const START_URL = process.env.START_URL || 'http://localhost:3000';
const GOAL = process.env.GOAL || 'Exercise the main user flow (add an item). Report anything broken or confusing.';
const ALLOWLIST = (process.env.ALLOWLIST || 'localhost').split(',');
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const log = (...a: unknown[]): void => console.log('[explore]', ...a);

async function main(): Promise<void> {
  const allow = makeAllowlist(ALLOWLIST);
  // The bundled demo server is a dev convenience; it ships only with the repo, not the published
  // package (files:[dist]). Spawn it only when it's actually present — an installed `qa-focus`
  // points START_URL at the user's own app.
  let server;
  const demoServer = join(HERE, '../fixtures/app/server.mjs');
  if (START_URL.startsWith('http://localhost:3000') && existsSync(demoServer)) {
    server = spawn('node', [demoServer], { stdio: 'ignore', env: { ...process.env, PORT: '3000' } });
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
  // Electron exposes no CDP endpoint — it uses the in-process action driver (ADR 0005) instead
  // of the @playwright/cli; web/openfin still require a CDP endpoint for the CLI to attach.
  if (!cdpEndpoint && surface.kind !== 'electron') throw new Error(`surface "${surface.kind}" exposes no CDP endpoint for the playwright-cli to attach to (web/openfin only)`);
  if (surface.kind === 'web') await guardContext(context, allow); // allowlist applies to real web surfaces
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const sink = newSink();
  attachCollectors(page, sink, allow);
  const findings: Finding[] = [];
  // The structured, durable record of the discovered flow (semantic steps, not refs) —
  // written alongside the Markdown artifact and fed to the codifier (FLOW=…) to harden.
  const flow = newFlow({ goal: GOAL, startUrl: START_URL, surface: process.env.SURFACE || 'web' });

  // Electron loads its own app (provider's _electron.launch → loadFile); navigating it to START_URL
  // would replace that app with the web fixture. Only web/openfin start from a URL.
  if (surface.kind !== 'electron' && allow(START_URL)) { await page.goto(START_URL, { waitUntil: 'domcontentloaded' }); sink.steps.push(`goto ${START_URL}`); flow.steps.push({ action: 'goto', url: START_URL }); }

  // Attach the action surface to the same page: the @playwright/cli over CDP for web/openfin,
  // or the in-process driver for Electron (no CDP endpoint). Both expose the same PwCli shape.
  const { pwcli: pw, getCtx } = cdpEndpoint
    ? await attachCli({ cdpEndpoint, page, session: 'qa-focus' })
    : await attachInProcess({ page, session: 'qa-focus' });

  // The control model (hard leash + step budget) lives in src/harness.mts (ADR 0002). The
  // budget is the runaway-loop circuit-breaker: on exhaustion the model is denied further
  // tools and told to stop and summarize (it still writes its findings artifact).
  const { session, client } = await createGatedSession({
    cli: CLI,
    model: process.env.COPILOT_MODEL,
    tools: makeBrowserTools({ getCtx, allow, allowlist: ALLOWLIST, sink, findings, flow, saveState: surface.saveState, statePath: process.env.STORAGE_STATE }),
    stepBudget: Number(process.env.STEP_BUDGET || 60),
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
  // The machine-readable flow — the codifier's input for the M4 handoff.
  const flowOut = join(HERE, '../artifacts/explore-flow.json');
  writeFileSync(flowOut, JSON.stringify(flow, null, 2));
  log('artifact:', out, '| flow:', flowOut, `(${flow.steps.length} steps)`);
  console.log('\n' + md);

  await pw.detach().catch(() => {});
  await client.stop?.();
  await surface.close();
  server?.kill();
}

main().catch((e) => { console.error('[explore] FAILED:', e?.stack || e); process.exit(1); });
