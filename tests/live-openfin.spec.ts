// Real-signal verify on a LIVE OpenFin window (#0002). OpenFin's runtime is Windows/macOS only —
// no Linux — so this is opt-in, like tests/live-electron.spec.ts. The connectOverCDP MECHANISM
// (attach, window-as-Page, gate grading, multi-window selection) is proven deterministically on
// chromium in tests/openfin-cdp.spec.ts; this takes the signal on the real RVM.
//
// Launch the fixture (see fixtures/openfin/README.md), then:
//   OPENFIN_LIVE=1 OPENFIN_CDP=http://localhost:9222 npx playwright test live-openfin
import { test, expect } from '@playwright/test';
import { openSurface, listWindows } from '../src/provider.mjs';
import { gradeLocator } from '../extension/qa-focus/ladder.mjs';

const OPENFIN_LIVE = !!process.env.OPENFIN_LIVE;
const CDP = process.env.OPENFIN_CDP || 'http://localhost:9222';

test('LIVE openfin: provider attaches over CDP and the gate grades inside an OpenFin window', async () => {
  test.skip(!OPENFIN_LIVE, 'set OPENFIN_LIVE=1 + OPENFIN_CDP (needs the OpenFin RVM on Win/macOS) to run');
  const s = await openSurface({ kind: 'openfin', cdpUrl: CDP });
  try {
    expect(s.page).toBeTruthy();
    // The fixture page (fixtures/openfin/index.html) exposes an accessible heading "Todo".
    const g = await gradeLocator(s.page, { tier: 'role', role: 'heading', name: 'Todo' });
    expect(g.ok).toBe(true);
    expect(g.ok && g.tier).toBe('role');
  } finally {
    await s.close();
  }
});

test('LIVE openfin: a raw CSS locator is bounced toward the accessible role (gate unchanged on OpenFin)', async () => {
  test.skip(!OPENFIN_LIVE, 'set OPENFIN_LIVE=1 + OPENFIN_CDP to run');
  const s = await openSurface({ kind: 'openfin', cdpUrl: CDP });
  try {
    const g = await gradeLocator(s.page, { tier: 'css', expression: '#new-task', reason: 'probe' });
    expect(g.ok).toBe(false);
    expect(g.ok === false && g.suggestedTier).toBeTruthy();
  } finally {
    await s.close();
  }
});

test('LIVE openfin: multi-window selection enumerates windows on the real RVM', async () => {
  test.skip(!OPENFIN_LIVE, 'set OPENFIN_LIVE=1 + OPENFIN_CDP to run');
  const s = await openSurface({ kind: 'openfin', cdpUrl: CDP });
  try {
    expect(listWindows(s.browser!).length).toBeGreaterThanOrEqual(1);
  } finally {
    await s.close();
  }
});
