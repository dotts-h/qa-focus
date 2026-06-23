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
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { Page } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the @playwright/cli executable robustly. A hardcoded `../node_modules/.bin/...` hop is
 * wrong from the published build (the module ships at `dist/src/`, node_modules sits at the package
 * root, not under `dist/`). `createRequire().resolve` walks up node_modules from THIS module the
 * same way `import` does — correct in dev (`src/`), in the build (`dist/src/`), and in a consumer's
 * install. We read the package's `bin` entry and run it through `node`, so it works regardless of
 * the file's executable bit. Falls back to the old relative path if resolution somehow fails.
 */
function resolveCliBin(): string {
  try {
    const pkgPath = createRequire(import.meta.url).resolve('@playwright/cli/package.json');
    const bin = (JSON.parse(readFileSync(pkgPath, 'utf8')) as { bin?: string | Record<string, string> }).bin;
    const rel = typeof bin === 'string' ? bin : bin?.['playwright-cli'];
    if (rel) return join(dirname(pkgPath), rel);
  } catch { /* fall through to the dev path */ }
  return join(HERE, '../node_modules/.bin/playwright-cli');
}
const DEFAULT_BIN = resolveCliBin();

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

/** Build a CLI driver bound to one browser session. cwd defaults to process.cwd() so an installed
 *  `qa-focus` operates in the USER's project — the CLI's workspace keying and any relative path
 *  args resolve there, not against the package install dir. Captured once, so attach/cmd/detach
 *  share a consistent cwd. */
export function makePwCli({ bin = DEFAULT_BIN, session = 'qa-focus', cwd = process.cwd() }: { bin?: string; session?: string; cwd?: string } = {}): PwCli {
  // Run the resolved bin THROUGH node (not as a bare executable) so it works regardless of the
  // file's +x bit, while staying argv-discrete with no shell — the prompt-injection defense (ADR 0001).
  const run = (args: string[]): Promise<CliResult> =>
    new Promise((resolve) => {
      execFile(process.execPath, [bin, ...args], { cwd, maxBuffer: 16 << 20 }, (err, stdout, stderr) => {
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
