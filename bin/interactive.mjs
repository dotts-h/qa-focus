// interactive.mjs — the ENFORCING interactive loop (drive → explore → harden).
//
// Same hard leash as the autonomous explorer: availableTools is caged to ONLY our
// gated tools (browser_* + propose_locator/write_spec/run_spec), and onPreToolUse
// denies anything else — so the model CANNOT shell out or write arbitrary files to
// route around the gate. (The Copilot *extension* cannot remove copilot's built-in
// fs/shell tools, so in a copilot session the model can bypass the gate — observed in
// a real run. This REPL is the path that actually enforces the control model while
// staying interactive: you type goals turn-by-turn against ONE persistent session.)
//
//   you> log in as alice and stop
//   you> now explore the checkout flow and report anything broken
//   you> harden the add-to-cart flow into a Playwright test
//   you> exit
//
// Env: COPILOT_CLI, COPILOT_MODEL, START_URL, ALLOWLIST (csv), PW_CHANNEL, CDP_PORT,
//      HEADED=1, SLOWMO, FORCE_OPEN_SHADOW=1, SURFACE, CDP_URL.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CopilotClient, RuntimeConnection, ToolSet, defineTool, approveAll } from '@github/copilot-sdk';
import { openSurface } from '../src/provider.mjs';
import { makeAllowlist, guardContext } from '../src/allowlist.mjs';
import { newSink, attachCollectors, renderArtifact } from '../src/evidence.mjs';
import { makePwCli } from '../src/pwcli.mjs';
import { makeBrowserTools } from '../src/browser-tools.mjs';
import { makeCodifyTools } from '../src/codify-tools.mjs';
import { resolveCopilotCli } from '../src/copilot-path.mjs';
import { STANDARDS_PROMPT } from '../src/standards.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CLI = resolveCopilotCli();
const START_URL = process.env.START_URL || 'http://localhost:3000';
const ALLOWLIST = (process.env.ALLOWLIST || 'localhost').split(',');
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const log = (...a) => console.log('[qa]', ...a);

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
    headless: !process.env.HEADED,
    slowMo: process.env.HEADED ? Number(process.env.SLOWMO || 350) : undefined,
    forceOpenShadow: !!process.env.FORCE_OPEN_SHADOW,
    cdpUrl: process.env.CDP_URL,
    storageState: process.env.STORAGE_STATE, // reuse a captured login if the file exists
  });
  const { context, page, cdpEndpoint } = surface;
  if (!cdpEndpoint) throw new Error(`surface "${surface.kind}" exposes no CDP endpoint for the playwright-cli to attach to`);
  if (surface.kind === 'web') await guardContext(context, allow);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const sink = newSink();
  attachCollectors(page, sink, allow);
  const findings = [];
  const facts = [];

  if (allow(START_URL)) { await page.goto(START_URL, { waitUntil: 'domcontentloaded' }); sink.steps.push(`goto ${START_URL}`); }

  const pw = makePwCli({ session: 'qa-focus-repl' });
  const att = await pw.attach(cdpEndpoint);
  if (!att.ok) throw new Error(`playwright-cli failed to attach over CDP: ${att.out}`);
  const getCtx = async () => ({ page, pwcli: pw });

  const tools = [
    ...makeBrowserTools({ getCtx, allow, allowlist: ALLOWLIST, sink, findings, saveState: surface.saveState, statePath: process.env.STORAGE_STATE }),
    ...makeCodifyTools({ getCtx, root: ROOT, facts }),
  ].map(({ name, def }) => defineTool(name, def));
  const names = tools.map((t) => t.name ?? t.definition?.name).filter(Boolean);

  const client = new CopilotClient({ connection: RuntimeConnection.forStdio({ path: CLI }) });
  const session = await client.createSession({
    ...(process.env.COPILOT_MODEL ? { model: process.env.COPILOT_MODEL } : {}),
    tools,
    availableTools: new ToolSet().addCustom('*'), // HARD leash: only our tools exist
    onPermissionRequest: approveAll,
    hooks: {
      onUserPromptSubmitted: async () => {
        const extra = facts.length ? `\nESTABLISHED THIS SESSION:\n- ${facts.slice(-12).join('\n- ')}` : '';
        return { additionalContext: STANDARDS_PROMPT + extra };
      },
      onPreToolUse: async ({ toolName }) =>
        names.includes(toolName) ? undefined : { permissionDecision: 'deny', permissionDecisionReason: `not a qa-focus tool: ${toolName}` },
    },
  });

  const saveArtifact = async () => {
    mkdirSync(join(ROOT, 'artifacts'), { recursive: true });
    const tracePath = join(ROOT, 'artifacts/interactive-trace.zip');
    await context.tracing.stop({ path: tracePath }).catch(() => {});
    writeFileSync(join(ROOT, 'artifacts/interactive-report.md'), renderArtifact({ goal: 'interactive session', sink, findings, tracePath }));
  };

  log(`ready — ${surface.kind} surface, allowlist [${ALLOWLIST.join(', ')}]${process.env.HEADED ? ', HEADED' : ''}. Type a goal; "exit" to finish.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'you> ' });
  rl.prompt();
  for await (const line of rl) {
    const goal = line.trim();
    if (!goal) { rl.prompt(); continue; }
    if (['exit', 'quit', ':q'].includes(goal.toLowerCase())) break;
    try {
      const before = findings.length;
      const res = await session.sendAndWait({ prompt: goal }, 240_000);
      const text = typeof res === 'string' ? res : res?.text ?? res?.content ?? '';
      if (text) console.log(`\n${text}\n`);
      if (findings.length > before) {
        log(`findings (+${findings.length - before}):`);
        for (const f of findings.slice(before)) console.log(`  - [${f.severity || '?'}] ${f.title}`);
      }
    } catch (e) {
      console.error('[qa] turn failed:', e?.message || e);
    }
    rl.prompt();
  }

  await saveArtifact();
  log('artifact: artifacts/interactive-report.md');
  await pw.detach().catch(() => {});
  await client.stop?.();
  await surface.close();
  server?.kill();
}

main().catch((e) => { console.error('[qa] FAILED:', e?.stack || e); process.exit(1); });
