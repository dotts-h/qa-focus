// Surface-aware authored-spec shape (#0027, ADR 0011). The codifier must author a spec that
// EXECUTES on the surface the flow was discovered on — a web `page.goto` spec for web/openfin, an
// `_electron.launch` spec for Electron — and both shapes must pass the standards linter + capability
// scan that gate every authored spec. These are deterministic (no model, no quota): they assert the
// instruction the prompt injects and that a representative spec of each shape clears the gates.
import { test, expect } from '@playwright/test';
import { specShapeInstruction, lintSpec } from '../src/standards.mjs';
import { scanSpecCapabilities, safeSpecEnv } from '../src/spec-guard.mjs';

test('web/openfin shape instructs a URL-navigated web spec, not Electron', () => {
  for (const surface of ['web', 'openfin']) {
    const instr = specShapeInstruction(surface, {});
    expect(instr).toMatch(/@playwright\/test/);
    expect(instr.toLowerCase()).toMatch(/url|navigate/);
    expect(instr).not.toMatch(/_electron/);
  }
});

test('electron shape instructs an _electron.launch spec (no goto) with the app path', () => {
  const instr = specShapeInstruction('electron', { appPath: 'fixtures/electron' });
  expect(instr).toMatch(/_electron\.launch/);
  expect(instr).toMatch(/firstWindow/);
  expect(instr).toMatch(/QA_ELECTRON_APP/);      // portable app-path env var
  expect(instr).toMatch(/fixtures\/electron/);   // baked default when the env var is unset
  expect(instr.toLowerCase()).toMatch(/no .*goto|do not .*goto|never .*goto/);
});

// A representative Electron spec of exactly the shape the prompt describes — it must clear BOTH
// gates unchanged (the whole point: the gates accept the legit `_electron`/`playwright` imports).
const ELECTRON_SPEC = `import { test, expect, _electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  electronApp = await _electron.launch({ args: [process.env.QA_ELECTRON_APP ?? 'fixtures/electron', '--no-sandbox'] });
  page = await electronApp.firstWindow();
});
test.afterAll(async () => { await electronApp?.close(); });

test('Electron Todo app loads', async () => {
  await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
  await page.getByRole('textbox', { name: 'New task' }).fill('Buy groceries');
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
});
`;

// ELECTRON_SPEC is hand-maintained; tie it to the instruction so the two can't silently drift —
// if specShapeInstruction changes the launch line, this fails until ELECTRON_SPEC is updated, so the
// "passes the gates" tests below keep proving the CURRENTLY-instructed shape (not a stale one).
test('the representative spec matches the launch line specShapeInstruction mandates', () => {
  const launch = "_electron.launch({ args: [process.env.QA_ELECTRON_APP ?? 'fixtures/electron', '--no-sandbox'] })";
  expect(ELECTRON_SPEC).toContain(launch);
  expect(specShapeInstruction('electron', { appPath: 'fixtures/electron' })).toContain(launch);
});

test('the Electron spec shape passes the standards linter', () => {
  const { ok, violations } = lintSpec(ELECTRON_SPEC);
  expect(ok, JSON.stringify(violations)).toBe(true);
});

test('the Electron spec shape passes the host-capability scan (legit _electron/playwright imports)', () => {
  const { ok, violations } = scanSpecCapabilities(ELECTRON_SPEC);
  expect(ok, JSON.stringify(violations)).toBe(true);
});

test('safeSpecEnv passes QA_ELECTRON_APP through to the spec process', () => {
  const env = safeSpecEnv({ QA_ELECTRON_APP: 'fixtures/electron', SECRET_TOKEN: 'nope' });
  expect(env.QA_ELECTRON_APP).toBe('fixtures/electron');
  expect(env.SECRET_TOKEN).toBeUndefined(); // host secrets still dropped
});
