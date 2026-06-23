// interactive.mts — the ENFORCING interactive loop (drive → explore → harden).
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
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createGatedSession } from '../src/harness.mjs';
import { openSurface } from '../src/provider.mjs';
import { makeAllowlist, guardContext } from '../src/allowlist.mjs';
import { newSink, attachCollectors, renderArtifact } from '../src/evidence.mjs';
import type { Finding } from '../src/evidence.mjs';
import { attachCli } from '../src/pwcli.mjs';
import { attachInProcess } from '../src/inproc-driver.mjs';
import { makeBrowserTools } from '../src/browser-tools.mjs';
import { makeCodifyTools } from '../src/codify-tools.mjs';
import { resolveCopilotCli } from '../src/copilot-path.mjs';
import { STANDARDS_PROMPT } from '../src/standards.mjs';
import { renderCostSummary } from '../src/cost.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// Specs, artifacts and the run_spec gate belong in the USER's project (their playwright.config),
// so ROOT is the invocation cwd — not join(HERE,'..') (the package's dist/ when installed). In dev
// (run from the repo root) process.cwd() IS the repo root, so behavior is unchanged.
const ROOT = process.cwd();
const CLI = resolveCopilotCli();
const START_URL = process.env.START_URL || 'http://localhost:3000';
const ALLOWLIST = (process.env.ALLOWLIST || 'localhost').split(',');
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
// Live run stream is default-on; silence it for piped runs (#0013).
const QUIET = !!process.env.QA_QUIET || process.argv.includes('--quiet');
// Optional credits→$ rate (USD per AI-Credit) for the cost summary's $ estimate (#0014).
const AIU_USD = Number(process.env.QA_AIU_USD) || undefined;
const log = (...a: unknown[]): void => console.log('[qa]', ...a);

async function main(): Promise<void> {
  const allow = makeAllowlist(ALLOWLIST);
  // The bundled demo server ships only with the repo, not the published package — spawn it only
  // when present (an installed qa-focus points START_URL at the user's own app).
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
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const sink = newSink();
  attachCollectors(page, sink, allow);
  const findings: Finding[] = [];
  const facts: string[] = [];

  // Electron loads its own app; only web/openfin start from START_URL (see bin/explore.mts).
  if (surface.kind !== 'electron' && allow(START_URL)) { await page.goto(START_URL, { waitUntil: 'domcontentloaded' }); sink.steps.push(`goto ${START_URL}`); }

  const { pwcli: pw, getCtx } = cdpEndpoint
    ? await attachCli({ cdpEndpoint, page, session: 'qa-focus-repl' })
    : await attachInProcess({ page, session: 'qa-focus-repl' });

  // The control model (hard leash + recency) lives in src/harness.mts (ADR 0002). No step
  // budget here — turns are human-paced over stdin, so the human is the circuit-breaker.
  const { session, client, flushStream, detachStream, getUsage } = await createGatedSession({
    cli: CLI,
    model: process.env.COPILOT_MODEL,
    quiet: QUIET, // stream the model's reasoning/output/tool calls live unless silenced (#0013)
    tools: [
      ...makeBrowserTools({ getCtx, allow, allowlist: ALLOWLIST, sink, findings, saveState: surface.saveState, statePath: process.env.STORAGE_STATE }),
      ...makeCodifyTools({ getCtx, root: ROOT, facts }),
    ],
    recency: async () => {
      const extra = facts.length ? `\nESTABLISHED THIS SESSION:\n- ${facts.slice(-12).join('\n- ')}` : '';
      return { additionalContext: STANDARDS_PROMPT + extra };
    },
  });

  const saveArtifact = async (): Promise<void> => {
    mkdirSync(join(ROOT, 'artifacts'), { recursive: true });
    const tracePath = join(ROOT, 'artifacts/interactive-trace.zip');
    await context.tracing.stop({ path: tracePath }).catch(() => {});
    writeFileSync(join(ROOT, 'artifacts/interactive-report.md'), renderArtifact({ goal: 'interactive session', sink, findings, tracePath, usage: getUsage({ creditsToUsd: AIU_USD }) }));
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
      const r: any = res;
      const text = typeof r === 'string' ? r : r?.text ?? r?.content ?? r?.data?.content ?? '';
      // When streaming (not quiet) the answer already rendered live — flush the turn's open block
      // (one trailing newline, renderer reset for the next turn); only the quiet/piped path reprints.
      if (QUIET) { if (text) console.log(`\n${text}\n`); } else flushStream();
      if (findings.length > before) {
        log(`findings (+${findings.length - before}):`);
        for (const f of findings.slice(before)) console.log(`  - [${f.severity || '?'}] ${f.title}`);
      }
    } catch (e: any) {
      console.error('[qa] turn failed:', e?.message || e);
    }
    rl.prompt();
  }

  detachStream();
  console.log('\n' + renderCostSummary(getUsage({ creditsToUsd: AIU_USD }))); // the session's total cost (#0014)
  await saveArtifact();
  log('artifact: artifacts/interactive-report.md');
  await pw.detach().catch(() => {});
  await client.stop?.();
  await surface.close();
  server?.kill();
}

main().catch((e) => { console.error('[qa] FAILED:', e?.stack || e); process.exit(1); });
