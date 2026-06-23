// OpenFin attach mechanism + multi-window selection (issue #0002), verified DETERMINISTICALLY.
//
// OpenFin is Chromium driven over CDP: the provider does `chromium.connectOverCDP(cdpUrl)` then
// `contexts()/pages()` — the EXACT same Playwright path works against any Chromium exposing a CDP
// endpoint. So we stand up a normal chromium with `--remote-debugging-port` (via the `web` surface),
// then attach through the `openfin` surface to prove: the provider attaches over CDP, a window is a
// Page, the gate grades inside it, and the multi-window helper selects the right window — all with
// no OpenFin runtime (which is Windows/macOS-only). The real-RVM run is the opt-in OPENFIN_LIVE test
// in tests/live-openfin.spec.ts.
import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:net';
import { openSurface, listWindows, pickWindow } from '../src/provider.mjs';
import { gradeLocator } from '../extension/qa-focus/ladder.mjs';

// A currently-free ephemeral port per test. Hardcoded absolute ports are a flake/false-pass vector:
// if one is already bound (a leftover chromium from a retried run, or any other process), chromium's
// --remote-debugging-port silently fails to bind and connectOverCDP would attach to the STALE
// browser. A fresh OS-assigned port avoids that entirely.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error('no port'))));
    });
  });
}

test('openfin provider attaches over CDP; a window is a usable Page', async () => {
  const host = await openSurface({ kind: 'web', cdpPort: await freePort(), channel: process.env.PW_CHANNEL });
  try {
    await host.page.setContent('<title>Alpha</title><h1>Alpha</h1>');
    const of = await openSurface({ kind: 'openfin', cdpUrl: host.cdpEndpoint! });
    try {
      expect(of.kind).toBe('openfin');
      expect(of.cdpEndpoint).toBe(host.cdpEndpoint);
      // It's a real Page: the gate grades a role+name on it exactly as on web/electron.
      const g = await gradeLocator(of.page, { tier: 'role', role: 'heading', name: 'Alpha' });
      expect(g.ok).toBe(true);
    } finally { await of.close(); }
  } finally { await host.close(); }
});

test('listWindows enumerates every page; pickWindow selects by title and by url', async () => {
  const host = await openSurface({ kind: 'web', cdpPort: await freePort(), channel: process.env.PW_CHANNEL });
  try {
    await host.page.goto('data:text/html,<title>Alpha</title>');
    const p2 = await host.context.newPage();
    await p2.goto('data:text/html,<title>Beta</title>');
    const browser = await chromium.connectOverCDP(host.cdpEndpoint!);
    try {
      expect(listWindows(browser).length).toBeGreaterThanOrEqual(2);
      const beta = await pickWindow(browser, { title: 'Beta' });
      expect(beta).toBeTruthy();
      expect(await beta!.title()).toBe('Beta');
      const byUrl = await pickWindow(browser, { url: /Alpha/ });
      expect(byUrl).toBeTruthy();
      expect(await byUrl!.title()).toBe('Alpha');
      // No match → undefined (never a wrong-window false positive).
      expect(await pickWindow(browser, { title: 'Zeta' })).toBeUndefined();
    } finally { await browser.close(); }
  } finally { await host.close(); }
});

test('openSurface(openfin, {window}) opens onto the matching window, not just the first', async () => {
  const host = await openSurface({ kind: 'web', cdpPort: await freePort(), channel: process.env.PW_CHANNEL });
  try {
    await host.page.setContent('<title>Alpha</title>');
    const p2 = await host.context.newPage();
    await p2.setContent('<title>Beta</title>');
    const of = await openSurface({ kind: 'openfin', cdpUrl: host.cdpEndpoint!, window: { title: 'Beta' } });
    try {
      expect(await of.page.title()).toBe('Beta');
    } finally { await of.close(); }
  } finally { await host.close(); }
});

test('openSurface(openfin, {window}) falls back to the FIRST window when no match', async () => {
  const host = await openSurface({ kind: 'web', cdpPort: await freePort(), channel: process.env.PW_CHANNEL });
  try {
    await host.page.setContent('<title>Alpha</title>');
    const p2 = await host.context.newPage();
    await p2.setContent('<title>Beta</title>');
    const of = await openSurface({ kind: 'openfin', cdpUrl: host.cdpEndpoint!, window: { title: 'Nope' } });
    try {
      // Falls back to one of the REAL existing windows (not undefined / an unrelated-browser page).
      // CDP doesn't guarantee contexts()/pages() ordering, so assert membership, not a specific one.
      expect(['Alpha', 'Beta']).toContain(await of.page.title());
    } finally { await of.close(); }
  } finally { await host.close(); }
});
