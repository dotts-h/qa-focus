// The authored-spec standards linter — deterministic enforcement of the Playwright
// stability rules the codifier must honor on complex apps.
import { test, expect } from '@playwright/test';
import { lintSpec } from '../src/standards.mjs';

const clean = `import { test, expect } from '@playwright/test';
test('add', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'New task' }).fill('milk');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('list', { name: 'tasks' })).toContainText('milk');
});`;

test('a clean web-first spec passes the linter', () => {
  const { ok, violations } = lintSpec(clean);
  expect(ok).toBe(true);
  expect(violations.filter((v) => !v.warn)).toHaveLength(0);
});

test('hard sleep (waitForTimeout) is a BLOCK violation', () => {
  const r = lintSpec(`await page.waitForTimeout(1000);`);
  expect(r.ok).toBe(false);
  expect(r.violations[0].rule).toBe('no-hard-sleep');
});

test('networkidle wait is a BLOCK violation', () => {
  const r = lintSpec(`await page.goto('/', { waitUntil: 'networkidle' });`);
  expect(r.ok).toBe(false);
  expect(r.violations.some((v) => v.rule === 'no-networkidle')).toBe(true);
});

test('raw page.$ handle is a BLOCK violation', () => {
  const r = lintSpec(`const el = await page.$('.btn');`);
  expect(r.ok).toBe(false);
  expect(r.violations.some((v) => v.rule === 'no-raw-element-handle')).toBe(true);
});

test('XPath (does not pierce shadow DOM) is a BLOCK violation', () => {
  const r = lintSpec(`await page.locator('//button[@id="x"]').click();`);
  expect(r.ok).toBe(false);
  expect(r.violations.some((v) => v.rule === 'no-xpath')).toBe(true);
});

test('waitForSelector is an advisory WARN, not a block', () => {
  const r = lintSpec(`await page.waitForSelector('.ready');`);
  expect(r.ok).toBe(true); // warn only
  expect(r.violations.some((v) => v.rule === 'no-waitForSelector' && v.warn)).toBe(true);
});

test('a rule keyword inside a // comment is ignored', () => {
  const r = lintSpec(`// do not use waitForTimeout here\nawait expect(page.getByRole('button')).toBeVisible();`);
  expect(r.ok).toBe(true);
});
