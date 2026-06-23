// Codifier DEPTH (production output for real apps): storageState auth reuse + linted POMs.
// Deterministic — no browser, no model. The worked end-to-end (POM + fixture spec against
// the fixture app) lives in tests/authored/todo-pom.spec.ts and runs under RUN_AUTHORED=1.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveStorageState } from '../src/authored.mjs';
import { makeCodifyTools } from '../src/codify-tools.mjs';

test('resolveStorageState reuses an existing capture, else falls back to undefined', () => {
  // present capture → reuse it
  expect(resolveStorageState('/cap/state.json', () => true)).toBe('/cap/state.json');
  // missing capture → undefined (Playwright throws on a missing path; offline/CI have none)
  expect(resolveStorageState('/cap/state.json', () => false)).toBeUndefined();
  // no path configured → undefined
  expect(resolveStorageState('', () => true)).toBeUndefined();
  expect(resolveStorageState(undefined)).toBeUndefined();
});

test('write_pom writes a clean page object and rejects a banned pattern', async () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-pom-'));
  try {
    const tools = makeCodifyTools({ getCtx: async () => ({}), root, facts: [] });
    const writePom = tools.find((t) => t.name === 'write_pom').def.handler;

    const clean =
      "import { type Page, type Locator } from '@playwright/test';\n" +
      'export class TodoPage {\n' +
      '  readonly add: Locator;\n' +
      "  constructor(page: Page) { this.add = page.getByRole('button', { name: 'Add' }); }\n" +
      '}\n';
    const okRes = await writePom({ name: 'Todo Page', code: clean });
    expect(typeof okRes).toBe('string');
    expect(okRes).toContain("from './todo-page.pom'"); // slugged + import hint
    expect(existsSync(join(root, 'tests', 'authored', 'todo-page.pom.ts'))).toBe(true);

    // a hard sleep in a POM is rejected exactly like in a spec
    const dirty = 'export class Bad { async go(page) { await page.waitForTimeout(500); } }';
    const badRes = await writePom({ name: 'bad', code: dirty });
    expect(badRes.resultType).toBe('failure');
    expect(badRes.textResultForLlm).toMatch(/no-hard-sleep/);
    expect(existsSync(join(root, 'tests', 'authored', 'bad.pom.ts'))).toBe(false); // not written
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('write_spec rejects a capability-violating spec and never writes it (#0022, ADR 0010)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-cap-'));
  try {
    const tools = makeCodifyTools({ getCtx: async () => ({}), root, facts: [] });
    const writeSpec = tools.find((t) => t.name === 'write_spec').def.handler;

    const malicious =
      "import { test, expect } from '@playwright/test';\n" +
      "import { readFileSync } from 'fs';\n" +
      "test('exfil', async () => { readFileSync('/etc/passwd'); });\n";
    const res = await writeSpec({ name: 'evil', code: malicious });
    expect(res.resultType).toBe('denied');
    expect(res.textResultForLlm).toMatch(/host capabilities/);
    expect(existsSync(join(root, 'tests', 'authored', 'evil.spec.ts'))).toBe(false); // not written
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run_spec BLOCKS before executing when a planted authored file accesses host capabilities', async () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-cap-run-'));
  try {
    const dir = join(root, 'tests', 'authored');
    mkdirSync(dir, { recursive: true });
    // A file placed directly on disk (not via write_spec) still cannot run — run_spec re-scans.
    writeFileSync(join(dir, 'planted.spec.ts'), "const cp = require('child_process'); cp.execSync('id');");

    const tools = makeCodifyTools({ getCtx: async () => ({}), root, facts: [] });
    const runSpec = tools.find((t) => t.name === 'run_spec').def.handler;
    const res = await runSpec({});
    expect(res.resultType).toBe('denied');
    expect(res.textResultForLlm).toMatch(/BLOCKED before run/);
    expect(res.textResultForLlm).toMatch(/planted\.spec\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
