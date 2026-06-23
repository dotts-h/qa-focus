// Thin gated wrapper over @playwright/cli — the explorer's token-efficient action
// surface (ADR 0001). The CLI saves snapshots to disk and hands the model compact
// element refs (`e15`) instead of streaming the full accessibility tree inline,
// so autonomous browsing stays ~4x cheaper in context.
//
// SECURITY: the model never gets raw shell. Each gated `defineTool` calls run()
// with the subcommand + already-typed arguments as DISCRETE argv entries (execFile,
// no shell) — so a hostile page's text can only ever land inside a value, never as
// a new command. This preserves the tool-gating prompt-injection defense even
// though we shell out to a binary.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BIN = join(HERE, '../node_modules/.bin/playwright-cli');

/** Build a CLI driver bound to one browser session. */
export function makePwCli({ bin = DEFAULT_BIN, session = 'qa-focus', cwd = join(HERE, '..') } = {}) {
  const run = (args) =>
    new Promise((resolve) => {
      execFile(bin, args, { cwd, maxBuffer: 16 << 20 }, (err, stdout, stderr) => {
        const out = `${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim();
        resolve({ ok: !err, out });
      });
    });

  return {
    session,
    /** Attach the CLI to an already-running browser over its CDP http endpoint. */
    attach: (cdpEndpoint) => run(['attach', '--cdp', cdpEndpoint, '--session', session]),
    /** Run a subcommand against this session, e.g. cmd('click', 'e5'). */
    cmd: (...args) => run([`-s=${session}`, ...args]),
    detach: () => run([`-s=${session}`, 'detach']),
  };
}
