// Codifier DEPTH (production output for real apps): storageState auth reuse + linted POMs.
// Deterministic — no browser, no model. The worked end-to-end (POM + fixture spec against
// the fixture app) lives in tests/authored/todo-pom.spec.ts and runs under RUN_AUTHORED=1.
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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
