// Untrusted-spec execution guard (#0022, ADR 0010). The codifier runs model-authored spec code
// through `playwright test`; this guard rejects host-capability access (fs/net/child_process/eval)
// at write+run time and scrubs the execution environment of host secrets. Deterministic, no model.
import { test, expect } from '@playwright/test';
import { scanSpecCapabilities, safeSpecEnv } from '../src/spec-guard.mjs';

const clean = `import { test, expect } from '@playwright/test';
import { TodoPage } from './todo.pom';
test('add', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'New task' }).fill('milk');
  await expect(page.getByRole('list', { name: 'tasks' })).toContainText('milk');
});`;

test('a clean browser-flow spec passes the capability scan', () => {
  const { ok, violations } = scanSpecCapabilities(clean);
  expect(ok).toBe(true);
  expect(violations).toHaveLength(0);
});

test('the auth-reuse fixture (imports a local module, reads process.env path) is allowed', () => {
  // tests/authored/fixtures.ts imports ../../src/authored.mjs and reads process.env.STORAGE_STATE —
  // a relative import + an env READ are legitimate; only process.binding and dangerous modules block.
  const fixture = `import { test as base, expect } from '@playwright/test';
import { resolveStorageState } from '../../src/authored.mjs';
const AUTH = process.env.AUTH_STATE || process.env.STORAGE_STATE || '.auth/state.json';
export const test = base.extend({ storageState: async ({}, use) => { await use(resolveStorageState(AUTH)); } });`;
  expect(scanSpecCapabilities(fixture).ok).toBe(true);
});

for (const [label, src] of [
  ['import fs (named)', `import { readFileSync } from 'fs';`],
  ['import node:fs', `import fs from 'node:fs';`],
  ['side-effect import net', `import 'net';`],
  ['child_process', `import { execSync } from 'node:child_process';`],
  ['dynamic import of fs', `const fs = await import('fs');`],
  ['require child_process', `const cp = require('child_process');`],
  ['eval', `eval('process.exit(1)');`],
  ['new Function', `const f = new Function('return process.env');`],
  ['process.binding', `const tcp = process.binding('tcp_wrap');`],
  ['non-literal dynamic import', `const m = await import(attackerControlled);`],
] as const) {
  test(`BLOCKS ${label}`, () => {
    const { ok, violations } = scanSpecCapabilities(src);
    expect(ok).toBe(false);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].warn).toBe(false);
  });
}

test('a comment mentioning a banned module does NOT trip the scan', () => {
  expect(scanSpecCapabilities(`// never import fs or child_process here`).ok).toBe(true);
});

test('a spaced LITERAL dynamic import of a safe local path is allowed; a variable one is blocked', () => {
  expect(scanSpecCapabilities(`const m = await import( "./helper.pom" );`).ok).toBe(true); // spaced literal — fine
  expect(scanSpecCapabilities(`const m = await import(  './fixtures'  );`).ok).toBe(true);
  expect(scanSpecCapabilities(`const m = await import( attackerControlled );`).ok).toBe(false); // non-literal — blocked
});

test('safeSpecEnv keeps operational vars + forces RUN_AUTHORED, drops host secrets', () => {
  const env = safeSpecEnv({
    PATH: '/usr/bin', HOME: '/home/x', PW_CHANNEL: 'chromium', STORAGE_STATE: '/tmp/state.json',
    SECRET_API_KEY: 'sk-deadbeef', AWS_SECRET_ACCESS_KEY: 'nope', GITHUB_TOKEN: 'ghp_x',
  });
  expect(env.PATH).toBe('/usr/bin');
  expect(env.HOME).toBe('/home/x');
  expect(env.PW_CHANNEL).toBe('chromium');
  expect(env.STORAGE_STATE).toBe('/tmp/state.json'); // auth-reuse path is operational, kept
  expect(env.RUN_AUTHORED).toBe('1'); // forced on
  expect(env.SECRET_API_KEY).toBeUndefined();
  expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
  expect(env.GITHUB_TOKEN).toBeUndefined();
});
