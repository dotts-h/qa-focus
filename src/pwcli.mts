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
import type { Page } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BIN = join(HERE, '../node_modules/.bin/playwright-cli');

/** The outcome of one CLI invocation: success flag + combined stdout/stderr. */
export interface CliResult {
  ok: boolean;
  out: string;
}

/** A CLI driver bound to one browser session (the explorer's action surface). */
export interface PwCli {
  session: string;
  attach: (cdpEndpoint: string) => Promise<CliResult>;
  cmd: (...args: string[]) => Promise<CliResult>;
  detach: () => Promise<CliResult>;
}

/** The per-call context the gated browser tools resolve (lazy page + its CLI driver). */
export interface BrowserCtx {
  page: Page;
  pwcli: PwCli;
}

/** Build a CLI driver bound to one browser session. */
export function makePwCli({ bin = DEFAULT_BIN, session = 'qa-focus', cwd = join(HERE, '..') }: { bin?: string; session?: string; cwd?: string } = {}): PwCli {
  const run = (args: string[]): Promise<CliResult> =>
    new Promise((resolve) => {
      execFile(bin, args, { cwd, maxBuffer: 16 << 20 }, (err, stdout, stderr) => {
        const out = `${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim();
        resolve({ ok: !err, out });
      });
    });

  return {
    session,
    /** Attach the CLI to an already-running browser over its CDP http endpoint. */
    attach: (cdpEndpoint: string) => run(['attach', '--cdp', cdpEndpoint, '--session', session]),
    /** Run a subcommand against this session, e.g. cmd('click', 'e5'). */
    cmd: (...args: string[]) => run([`-s=${session}`, ...args]),
    detach: () => run([`-s=${session}`, 'detach']),
  };
}

/**
 * Attach a CLI driver to an already-open surface and return the per-call context the gated
 * browser tools expect. Folds the makePwCli + attach + getCtx triplet every runner repeats;
 * throws if the CLI cannot attach over CDP. The tools resolve `getCtx()` per call (the page
 * is stable for the whole session, so a closure is enough).
 */
export async function attachCli(
  { cdpEndpoint, page, session = 'qa-focus' }: { cdpEndpoint: string; page: Page; session?: string },
): Promise<{ pwcli: PwCli; getCtx: () => Promise<BrowserCtx> }> {
  const pwcli = makePwCli({ session });
  const att = await pwcli.attach(cdpEndpoint);
  if (!att.ok) throw new Error(`playwright-cli failed to attach over CDP: ${att.out}`);
  return { pwcli, getCtx: async () => ({ page, pwcli }) };
}
