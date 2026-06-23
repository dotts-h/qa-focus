#!/usr/bin/env node
// qa-focus — the unified CLI entrypoint (ADR 0003: CLI-first, zero MCP).
//
// One command, three subcommands, dispatching to the autonomous harnesses. The
// harnesses read their configuration from an ENV contract (GOAL, START_URL, …); this
// CLI maps friendly flags onto that contract and execs the right bin, inheriting stdio
// so the live session streams straight through. Scaffolded in JS; ported under the
// TypeScript migration (ADR 0004 / issue #0005).
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));

// subcommand → harness script
const COMMANDS = { explore: 'explore.mjs', codify: 'codify.mjs', interactive: 'interactive.mjs' };

// value flag → the env var the harnesses already read
const VALUE_FLAGS = {
  '--goal': 'GOAL', '--url': 'START_URL', '--spec': 'SPEC_NAME', '--flow': 'FLOW',
  '--channel': 'PW_CHANNEL', '--surface': 'SURFACE', '--allowlist': 'ALLOWLIST',
  '--steps': 'STEP_BUDGET', '--model': 'COPILOT_MODEL', '--cdp-url': 'CDP_URL',
  '--storage-state': 'STORAGE_STATE',
};
// boolean flag → env var set to '1'
const BOOL_FLAGS = { '--headed': 'HEADED', '--force-open-shadow': 'FORCE_OPEN_SHADOW' };

/**
 * Parse argv (without node/script) into { cmd, env, unknown, missing }. Pure + exported so
 * the mapping is unit-tested without spawning a harness. Supports `--flag value` and
 * `--flag=value`; a value flag with no value is reported in `missing` (never silently
 * swallowed into a wrong harness default).
 */
export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const env = {};
  const unknown = [];
  const missing = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    // --flag=value form
    if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      const key = a.slice(0, eq);
      if (VALUE_FLAGS[key]) env[VALUE_FLAGS[key]] = a.slice(eq + 1);
      else unknown.push(a);
      continue;
    }
    if (BOOL_FLAGS[a]) { env[BOOL_FLAGS[a]] = '1'; continue; }
    if (VALUE_FLAGS[a]) {
      const next = rest[i + 1];
      // Don't consume a missing value (or the next flag) — that would silently fall back to a
      // harness default (e.g. a wrong GOAL on a live, quota-burning run). A value that
      // legitimately starts with -- can be passed via the --flag=value form.
      if (next === undefined || next.startsWith('--')) { missing.push(a); continue; }
      env[VALUE_FLAGS[a]] = next;
      i++;
      continue;
    }
    unknown.push(a);
  }
  return { cmd, env, unknown, missing };
}

function version() {
  try { return JSON.parse(readFileSync(join(HERE, '../package.json'), 'utf8')).version; }
  catch { return '0.0.0'; }
}

const HELP = `qa-focus ${version()} — control-first agentic QA (CLI, no MCP)

Usage: qa-focus <command> [options]

Commands:
  explore       Autonomously discover flows/bugs → evidence artifact + durable flow
  codify        Harden a flow into a gated, standards-compliant Playwright spec
  interactive   Enforcing REPL (hard leash) for hands-on authoring

Options (mapped onto the harness env contract):
  --goal <text>          what to do (GOAL)
  --url <url>            start URL (START_URL)
  --spec <name>         authored spec name (codify; SPEC_NAME)
  --flow <path>         seed codify from an explore flow (FLOW)
  --channel <name>      browser channel, e.g. chrome (PW_CHANNEL)
  --surface <kind>      web | electron | openfin (SURFACE)
  --allowlist <csv>     trusted hosts (ALLOWLIST)
  --steps <n>           step budget / circuit-breaker (STEP_BUDGET)
  --model <id>          model override (COPILOT_MODEL)
  --storage-state <p>   reuse a captured login (STORAGE_STATE)
  --cdp-url <url>       attach over CDP, e.g. openfin (CDP_URL)
  --headed              run headed (HEADED)
  --force-open-shadow   pierce closed shadow roots (FORCE_OPEN_SHADOW)
  -h, --help            show this help
  -v, --version         show version

Examples:
  qa-focus explore --goal "Add a task and verify it appears" --url http://localhost:3000
  qa-focus codify  --flow artifacts/explore-flow.json --spec todo-add
`;

function main(argv) {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') { process.stdout.write(HELP); return 0; }
  if (argv[0] === '-v' || argv[0] === '--version') { process.stdout.write(version() + '\n'); return 0; }
  const { cmd, env, unknown, missing } = parseArgs(argv);
  const script = COMMANDS[cmd];
  if (!script) { process.stderr.write(`qa-focus: unknown command '${cmd}'\n\n` + HELP); return 2; }
  if (missing.length) { process.stderr.write(`qa-focus: missing value for: ${missing.join(' ')}\n\n` + HELP); return 2; }
  if (unknown.length) { process.stderr.write(`qa-focus: unknown option(s): ${unknown.join(' ')}\n\n` + HELP); return 2; }
  const child = spawn(process.execPath, [join(HERE, script)], { stdio: 'inherit', env: { ...process.env, ...env } });
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (e) => { process.stderr.write(`qa-focus: failed to start ${cmd}: ${e.message}\n`); process.exit(1); });
  return null; // async — process exits via the child handler
}

// Run only when invoked directly (so tests can import parseArgs without side effects).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rc = main(process.argv.slice(2));
  if (rc !== null) process.exit(rc);
}
