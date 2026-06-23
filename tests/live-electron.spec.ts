// Real-signal gate check on a LIVE Electron window — proves the locator gate works
// UNCHANGED on a desktop (Electron) surface, not just web (M2). Electron windows are
// Playwright Pages, so gradeLocator() operates on them with no special-casing.
//
// Opt-in: needs the `electron` binary (not a hard dep) + a display. Run with:
//   npm i -D electron && ELECTRON_LIVE=1 xvfb-run -a npx playwright test live-electron
// Skipped by default so the deterministic suite stays offline, fast, and electron-free.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openSurface } from '../src/provider.mjs';
import { gradeLocator } from '../extension/qa-focus/ladder.mjs';

const ELECTRON_LIVE = !!process.env.ELECTRON_LIVE;
const HERE = dirname(fileURLToPath(import.meta.url));
// Electron must be launched against the APP DIRECTORY (with package.json "main"), not a
// bare main.js path — a bare file isn't treated as the app entry and firstWindow() hangs.
const APP_DIR = join(HERE, '../fixtures/electron');

test('LIVE electron: the gate grades a role+name button inside a real Electron window', async () => {
  test.skip(!ELECTRON_LIVE, 'set ELECTRON_LIVE=1 (needs electron + a display, e.g. xvfb-run -a) to run');
  const s = await openSurface({ kind: 'electron', electronArgs: ['--no-sandbox', APP_DIR] });
  try {
    const g = await gradeLocator(s.page, { tier: 'role', role: 'button', name: 'Add' });
    expect(g.ok).toBe(true);
    expect(g.tier).toBe('role');
  } finally {
    await s.close();
  }
});

test('LIVE electron: a raw CSS locator is bounced toward the accessible role (gate unchanged on desktop)', async () => {
  test.skip(!ELECTRON_LIVE, 'set ELECTRON_LIVE=1 to run');
  const s = await openSurface({ kind: 'electron', electronArgs: ['--no-sandbox', APP_DIR] });
  try {
    // #new-task has an accessible name ("New task") via its wrapping <label> → the gate
    // rejects raw CSS for it and points at the higher-priority accessible tier.
    const g = await gradeLocator(s.page, { tier: 'css', expression: '#new-task', reason: 'probe' });
    expect(g.ok).toBe(false);
    expect(g.suggestedTier).toBeTruthy();
  } finally {
    await s.close();
  }
});
