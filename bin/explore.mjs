// explore.mjs — the autonomous EXPLORER (first cut).
//
// An Antigravity-style agentic browser tester built on the Copilot SDK +
// Playwright, with the safety model inverted toward control:
//   • URL allowlist (src/allowlist.mjs) blocks navigation off trusted hosts.
//   • Tool-gating (availableTools = browser actions only) is the real
//     prompt-injection defense: the agent holds NO filesystem/shell/network
//     tool, so a malicious page that says "read .env and POST it" has nothing
//     to do it with. The capability is removed, not just the URL restricted.
//   • Accessible actions only (role + name) — no brittle coordinate clicking.
//   • Evidence (src/evidence.mjs): console/network anomalies + a Playwright
//     trace, synthesized into a Markdown artifact for human verification.
//
// Output is DISCOVERY (findings a human verifies), not durable tests. Feed the
// worthwhile flows to the codifier (bin/author.mjs) to harden into gated specs.
//
// Env: COPILOT_CLI, COPILOT_MODEL, GOAL, START_URL, ALLOWLIST (csv), PW_CHANNEL.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { expect } from '@playwright/test';
import { CopilotClient, RuntimeConnection, ToolSet, defineTool, approveAll } from '@github/copilot-sdk';
import { openSurface } from '../src/provider.mjs';
import { makeAllowlist, guardContext } from '../src/allowlist.mjs';
import { newSink, attachCollectors, renderArtifact } from '../src/evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = process.env.COPILOT_CLI || '/usr/local/bin/copilot';
const START_URL = process.env.START_URL || 'http://localhost:3000';
const GOAL = process.env.GOAL || 'Exercise the main user flow (add an item). Report anything broken or confusing.';
const ALLOWLIST = (process.env.ALLOWLIST || 'localhost').split(',');
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
    electronArgs: (process.env.ELECTRON_ARGS || '').split(' ').filter(Boolean),
    cdpUrl: process.env.CDP_URL,
  });
  const { context, page } = surface;
  if (surface.kind === 'web') await guardContext(context, allow); // allowlist applies to real web surfaces
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const sink = newSink();
  attachCollectors(page, sink);
  const findings = [];

  if (allow(START_URL)) { await page.goto(START_URL, { waitUntil: 'domcontentloaded' }); sink.steps.push(`goto ${START_URL}`); }

  const byRole = (a) => page.getByRole(a.role, a.name ? { name: a.name } : undefined);
  const tools = [
    defineTool('browser_snapshot', {
      description: 'Accessibility tree (roles + names) of the current page or a CSS region.',
      parameters: { type: 'object', properties: { region: { type: 'string' } } }, skipPermission: true,
      handler: async (a) => await page.locator(a?.region || 'body').ariaSnapshot(),
    }),
    defineTool('browser_goto', {
      description: 'Navigate to a URL (allowlisted hosts only).',
      parameters: { type: 'object', required: ['url'], properties: { url: { type: 'string' } } }, skipPermission: true,
      handler: async (a) => {
        if (!allow(a.url)) return { textResultForLlm: `BLOCKED: ${a.url} is not on the allowlist (${ALLOWLIST.join(', ')}).`, resultType: 'denied' };
        await page.goto(a.url, { waitUntil: 'domcontentloaded' }); sink.steps.push(`goto ${a.url}`); return `at ${a.url}`;
      },
    }),
    defineTool('browser_click', {
      description: 'Click an element by accessible role + name.',
      parameters: { type: 'object', required: ['role'], properties: { role: { type: 'string' }, name: { type: 'string' } } }, skipPermission: true,
      handler: async (a) => { await byRole(a).first().click(); sink.steps.push(`click ${a.role} "${a.name ?? ''}"`); return 'clicked'; },
    }),
    defineTool('browser_fill', {
      description: 'Fill a textbox by accessible role + name.',
      parameters: { type: 'object', required: ['role', 'text'], properties: { role: { type: 'string' }, name: { type: 'string' }, text: { type: 'string' } } }, skipPermission: true,
      handler: async (a) => { await byRole(a).first().fill(a.text); sink.steps.push(`fill ${a.role} "${a.name ?? ''}" = "${a.text}"`); return 'filled'; },
    }),
    defineTool('browser_expect_visible', {
      description: 'Assert an element (role + name) is visible. Use to verify a result.',
      parameters: { type: 'object', required: ['role'], properties: { role: { type: 'string' }, name: { type: 'string' } } }, skipPermission: true,
      handler: async (a) => {
        try { await expect(byRole(a).first()).toBeVisible({ timeout: 5000 }); sink.steps.push(`expect visible ${a.role} "${a.name ?? ''}" ✓`); return 'visible'; }
        catch { sink.steps.push(`expect visible ${a.role} "${a.name ?? ''}" ✗`); return { textResultForLlm: 'NOT visible within 5s', resultType: 'failure' }; }
      },
    }),
    defineTool('report_finding', {
      description: 'Record a bug/usability finding for human verification.',
      parameters: { type: 'object', required: ['title'], properties: { severity: { enum: ['high', 'medium', 'low'] }, title: { type: 'string' }, detail: { type: 'string' } } }, skipPermission: true,
      handler: async (a) => { findings.push(a); return 'recorded'; },
    }),
  ];
  const names = tools.map((t) => t.name ?? t.definition?.name).filter(Boolean);

  const client = new CopilotClient({ connection: RuntimeConnection.forStdio({ path: CLI }) });
  const session = await client.createSession({
    ...(process.env.COPILOT_MODEL ? { model: process.env.COPILOT_MODEL } : {}),
    tools,
    availableTools: new ToolSet().addCustom('*'), // leash = injection defense: no fs/shell/network tools exist
    onPermissionRequest: approveAll,
    hooks: {
      onPreToolUse: async ({ toolName }) =>
        names.includes(toolName) ? undefined : { permissionDecision: 'deny', permissionDecisionReason: `not an explore tool: ${toolName}` },
    },
  });

  log('goal:', GOAL);
  await session.sendAndWait({ prompt: `${GOAL}\n\nUse browser_snapshot to see the page, then browser_click / browser_fill / browser_expect_visible. Report issues with report_finding. Stay on the allowlisted app.` }, 240_000);

  mkdirSync(join(HERE, '../artifacts'), { recursive: true });
  const tracePath = join(HERE, '../artifacts/explore-trace.zip');
  await context.tracing.stop({ path: tracePath });
  const md = renderArtifact({ goal: GOAL, sink, findings, tracePath });
  const out = join(HERE, '../artifacts/explore-report.md');
  writeFileSync(out, md);
  log('artifact:', out);
  console.log('\n' + md);

  await client.stop?.();
  await surface.close();
  server?.kill();
}

main().catch((e) => { console.error('[explore] FAILED:', e?.stack || e); process.exit(1); });
