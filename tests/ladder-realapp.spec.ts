// Proves the ladder gate on a REAL, deliberately-messy public app
// (the-internet.herokuapp.com) — not the clean sandbox Todo app. No model, no
// Copilot quota: this is the deterministic proof that the gate does the right
// thing on good AND hostile markup.
//
// Network-dependent (hits a public site); retried once for flake tolerance.
import { test, expect } from '@playwright/test';
import { gradeLocator } from '../extension/qa-focus/ladder.mjs';

test.describe.configure({ retries: 1 });
test.use({ baseURL: 'https://the-internet.herokuapp.com' });

test.describe('ladder gate on a real bad app', () => {
  // ---- /login : accessible markup → the ladder must climb to the top ----
  test('login: bounces #username CSS up to role', async ({ page }) => {
    await page.goto('/login');
    const v = await gradeLocator(page, { tier: 'css', expression: '#username' });
    expect(v.ok).toBe(false);
    expect(v.suggestedTier).toBe('role');
  });

  test('login: accepts role for the username field', async ({ page }) => {
    await page.goto('/login');
    const v = await gradeLocator(page, { tier: 'role', role: 'textbox', name: 'Username' });
    expect(v.ok).toBe(true);
    expect(v.degraded).toBe(false);
  });

  // ---- /challenging_dom : hostile markup → unique resolve must fail, degrade ----
  test('challenging_dom: flat role "edit" is NOT unique (one per row) → rejected', async ({ page }) => {
    await page.goto('/challenging_dom');
    const v = await gradeLocator(page, { tier: 'role', role: 'link', name: 'edit' });
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('need exactly 1');
  });

  // NOTE: challenging_dom also has three top buttons whose labels are RANDOMIZED
  // on every page load (e.g. "baz"/"foo"/"qux") — a live demonstration of why
  // name-based locators are fragile on bad apps. We don't assert on them because
  // the app itself is non-deterministic; the stable "edit" links above already
  // prove duplicate-name rejection.

  test('challenging_dom: raw CSS for a row edit link is bounced toward a SCOPED accessible locator', async ({ page }) => {
    await page.goto('/challenging_dom');
    const v = await gradeLocator(page, {
      tier: 'css',
      expression: 'table tbody tr:nth-child(1) a[href="#edit"]',
      reason: 'no unique accessible handle', // even WITH a reason, scoping wins over raw CSS
    });
    expect(v.ok).toBe(false);
    expect(v.suggestedTier).toBe('scoped');
    expect(v.suggestion).toContain("getByRole('row'");
  });

  test('challenging_dom: a scoped accessible locator is accepted as non-degraded (no debt)', async ({ page }) => {
    await page.goto('/challenging_dom');
    const v = await gradeLocator(page, {
      intent: 'edit link in the first data row',
      tier: 'role', role: 'link', name: 'edit',
      scope: { tier: 'role', role: 'row', name: 'Iuvaret0' },
    });
    expect(v.ok).toBe(true);
    expect(v.tier).toBe('scoped');
    expect(v.degraded).toBe(false);
  });
});
