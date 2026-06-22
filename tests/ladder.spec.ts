// Probe: proves the locator-priority ladder gate (focus-probe/ladder.mjs) on the
// LIVE sandbox app — no model, no Copilot quota. This is the deterministic heart
// of the focus harness: focus-by-construction, with graceful degradation to
// CSS/XPath that is allowed-but-logged rather than silently permitted.
import { test, expect } from '@playwright/test';
import { gradeLocator } from '../extension/qa-focus/ladder.mjs';

test.describe('locator-priority ladder gate', () => {
  test('rejects CSS for the task input — a role locator resolves the same element', async ({ page }) => {
    await page.goto('/');
    const v = await gradeLocator(page, { tier: 'css', expression: '#new-task' });
    expect(v.ok).toBe(false);
    expect(v.suggestedTier).toBe('role');
  });

  test('accepts the role locator for the task input (top of the ladder)', async ({ page }) => {
    await page.goto('/');
    const v = await gradeLocator(page, { tier: 'role', role: 'textbox', name: 'New task' });
    expect(v.ok).toBe(true);
    expect(v.degraded).toBe(false);
  });

  test('rejects CSS for the Add button in favour of role', async ({ page }) => {
    await page.goto('/');
    const v = await gradeLocator(page, { tier: 'css', expression: '#add-form button' });
    expect(v.ok).toBe(false);
    expect(v.suggestedTier).toBe('role');
  });

  test('forces testid over a unique CSS selector when a testid exists', async ({ page }) => {
    await page.setContent('<button data-testid="save" aria-hidden="true"></button>');
    const v = await gradeLocator(page, { tier: 'css', expression: '[data-testid=save]' });
    expect(v.ok).toBe(false);
    expect(v.suggestedTier).toBe('testid');
  });

  test('allows CSS as LOGGED degradation when no accessible handle exists', async ({ page }) => {
    // Icon-only drag handle: a div with no role-name, label, text, or testid.
    await page.setContent('<div id="grip" style="width:20px;height:20px"></div><span>other</span>');

    const noReason = await gradeLocator(page, { tier: 'css', expression: '#grip' });
    expect(noReason.ok).toBe(false); // must justify the drop

    const withReason = await gradeLocator(page, {
      tier: 'css',
      expression: '#grip',
      reason: 'drag handle has no role/name/testid in this legacy app',
    });
    expect(withReason.ok).toBe(true);
    expect(withReason.degraded).toBe(true);
    expect(withReason.debt?.reason).toContain('legacy');
  });
});
