// Untrusted-spec execution guard (#0022, ADR 0010). The codifier runs MODEL-AUTHORED spec code
// through `playwright test` (full Node). The standards linter (standards.mts) blocks flaky patterns,
// NOT host-capability access. This guard adds two defense-in-depth layers around run_spec:
//   1. scanSpecCapabilities — reject source that imports a dangerous Node core module (fs, net,
//      child_process, …) or uses an eval/Function/require/process.binding escape, at write AND run time.
//   2. safeSpecEnv — a minimal allowlisted environment so the spec process sees NO host secrets,
//      bounding the blast radius even if (1) is bypassed by obfuscation.
// This is NOT a true OS sandbox (a determined obfuscated bypass could still construct a banned
// reference) — see ADR 0010; OS-level isolation is the documented future hardening. But it converts
// "full Node + full env" into "capability-checked + scrubbed env", closing the secret-exfil leg.
import type { Violation } from './standards.mjs';

/** Node core modules that an authored browser test never legitimately needs — the host-capability
 *  surface (filesystem, process spawning, raw network, code-eval). Matched with or without `node:`. */
const DANGEROUS_MODULES = new Set([
  'fs', 'fs/promises', 'child_process', 'worker_threads', 'cluster', 'net', 'tls', 'http', 'https',
  'http2', 'dns', 'dgram', 'vm', 'module', 'inspector', 'v8', 'repl', 'process', 'os',
  'diagnostics_channel', 'perf_hooks', 'async_hooks',
]);

const stripNode = (m: string): string => m.replace(/^node:/, '');

// Every quoted specifier reachable from an import/require/dynamic-import on a line.
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

// Dynamic-escape constructs that defeat any specifier allowlist. `require(` is blocked outright —
// authored ESM/TS specs import statically and never need it. A non-literal `import(` (variable or
// concatenation, i.e. not immediately a quote) is blocked as an obfuscation vector.
const ESCAPES: { rule: string; re: RegExp; why: string }[] = [
  { rule: 'no-eval', re: /\beval\s*\(/, why: 'eval() runs arbitrary code — not allowed in an authored test.' },
  { rule: 'no-function-ctor', re: /\bnew\s+Function\s*\(/, why: 'new Function() compiles arbitrary code — not allowed in an authored test.' },
  { rule: 'no-require', re: /\brequire\s*\(/, why: 'require() loads arbitrary modules — authored specs use static ESM imports of @playwright/test and local files only.' },
  { rule: 'no-process-binding', re: /\bprocess\s*\.\s*binding\b/, why: 'process.binding reaches native internals — not allowed.' },
  // Keep the whitespace INSIDE the lookahead: `import( "x" )` (spaced literal) is fine; only a
  // non-literal `import(variable)` is the obfuscation vector. (A `\s*` outside the lookahead would
  // backtrack to zero and wrongly flag the spaced literal.)
  { rule: 'no-dynamic-import', re: /\bimport\s*\((?!\s*['"])/, why: 'a non-literal dynamic import() is an obfuscation vector — import statically from a quoted path.' },
];

/** Scan model-authored spec/POM source for host-capability access. Comment-aware (a `//`-only line
 *  is ignored, mirroring lintSpec). Returns the same `{ ok, violations }` shape as the standards
 *  linter so `renderViolations` can format the result. `ok` is false when any violation fired. */
export function scanSpecCapabilities(source: string = ''): { ok: boolean; violations: Violation[] } {
  const violations: Violation[] = [];
  source.split('\n').forEach((text, i) => {
    // Blank out comment-ONLY lines so guidance comments (e.g. "// don't import fs") don't trip rules.
    const code = /^\s*\/\//.test(text) ? '' : text;
    if (!code) return;
    const at = (rule: string, why: string): void => {
      violations.push({ rule, line: i + 1, snippet: text.trim().slice(0, 120), why, warn: false });
    };
    for (const m of code.matchAll(SPECIFIER_RE)) {
      if (DANGEROUS_MODULES.has(stripNode(m[1]))) {
        at('no-node-capability', `imports Node core module "${m[1]}" — authored browser tests must not touch the host filesystem/process/network.`);
      }
    }
    for (const e of ESCAPES) if (e.re.test(code)) at(e.rule, e.why);
  });
  return { ok: violations.length === 0, violations };
}

// Env vars an authored Playwright run legitimately needs. Everything else (host secrets — API keys,
// tokens) is dropped. STORAGE_STATE/AUTH_STATE are file PATHS the authored auth-reuse fixture reads
// (tests/authored/fixtures.ts); they are operational, not secrets, so they stay.
const ENV_ALLOWLIST = [
  'PATH', 'HOME', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'TERM',
  'TMPDIR', 'TEMP', 'TMP', 'DISPLAY', 'XAUTHORITY', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME',
  'CI', 'NODE_PATH', 'PW_CHANNEL', 'PLAYWRIGHT_BROWSERS_PATH', 'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD',
  'STORAGE_STATE', 'AUTH_STATE',
];

/** Build a minimal, allowlisted environment for executing an untrusted authored spec — only the vars
 *  Playwright/Node need, plus `RUN_AUTHORED=1`. Host secrets are dropped so a spec that slips past the
 *  capability scan still cannot read them. */
export function safeSpecEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const k of ENV_ALLOWLIST) if (base[k] !== undefined) env[k] = base[k];
  env.RUN_AUTHORED = '1';
  return env;
}
