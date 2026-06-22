// Deterministic proof of the web surface provider. The electron/openfin paths
// share the same Page contract (verified by Playwright's own Electron/CDP APIs)
// but need a real desktop app to exercise — see docs/PLAN.md M2.
import { test, expect } from '@playwright/test';
import { openSurface } from '../src/provider.mjs';

test('web provider opens a usable Page', async () => {
  const s = await openSurface({ kind: 'web', channel: process.env.PW_CHANNEL });
  try {
    await s.page.setContent('<h1>hi</h1>');
    await expect(s.page.getByRole('heading', { name: 'hi' })).toBeVisible();
  } finally {
    await s.close();
  }
});

test('openfin provider requires a cdpUrl', async () => {
  await expect(openSurface({ kind: 'openfin' })).rejects.toThrow(/cdpUrl/);
});
