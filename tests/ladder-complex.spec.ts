// The locator gate on COMPLEX surfaces: iframes, open shadow DOM, closed shadow DOM.
// Grounds the production claim that the gate handles enterprise app structure.
import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium, Browser } from 'playwright';
import { gradeLocator, render } from '../extension/qa-focus/ladder.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

let server: ChildProcess;
let browser: Browser;
let URL: string;

test.beforeAll(async () => {
  server = spawn('node', [join(HERE, '../fixtures/complex/server.mjs')], {
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, CX_PORT: '0' }, // ephemeral port → no cross-run collision
  });
  // The server prints its bound port once it's actually listening — that line is
  // both the address and the readiness signal (replaces a fixed-delay sleep).
  const port = await new Promise<number>((resolve) => {
    server.stdout!.on('data', (b) => {
      const m = String(b).match(/localhost:(\d+)/);
      if (m) resolve(Number(m[1]));
    });
  });
  URL = `http://localhost:${port}`;
});
test.afterAll(async () => {
  await browser?.close();
  server?.kill();
});

async function open(forceOpenShadow = false) {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL });
  const context = await browser.newContext();
  if (forceOpenShadow) {
    await context.addInitScript(() => {
      const orig = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (init: ShadowRootInit) {
        return orig.call(this, { ...init, mode: 'open' });
      };
    });
  }
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  return page;
}

async function openAt(path: string) {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL });
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${URL}${path}`, { waitUntil: 'domcontentloaded' });
  return page;
}

test('open shadow DOM: the gate grades a button inside an open shadow root (Playwright pierces it)', async () => {
  const page = await open();
  const g = await gradeLocator(page, { tier: 'role', role: 'button', name: 'Open Shadow Btn' });
  expect(g.ok).toBe(true);
  expect(g.tier).toBe('role');
});

test('iframe: role locator on the PAGE fails (frames are not pierced) — needs a frame', async () => {
  const page = await open();
  const noFrame = await gradeLocator(page, { tier: 'role', role: 'button', name: 'Frame Submit' });
  expect(noFrame.ok).toBe(false); // resolves to 0 on the top document
});

test('iframe: with frame set, the gate grades the in-frame button and renders a frameLocator', async () => {
  const page = await open();
  const g = await gradeLocator(page, { tier: 'role', role: 'button', name: 'Frame Submit', frame: 'iframe[title="Editor"]' });
  expect(g.ok).toBe(true);
  expect(render({ tier: 'role', role: 'button', name: 'Frame Submit', frame: 'iframe[title="Editor"]' }))
    .toBe(`page.frameLocator('iframe[title="Editor"]').getByRole('button', { name: 'Frame Submit' })`);
});

test('iframe: a field inside the frame is gradeable at the role tier', async () => {
  const page = await open();
  const g = await gradeLocator(page, { tier: 'role', role: 'textbox', name: 'Frame field', frame: 'iframe[title="Editor"]' });
  expect(g.ok).toBe(true);
});

test('legacy <frameset>/<frame>: frameLocator cannot reach it, the gate DEGRADES to the Frame API (by name) and grades', async () => {
  const page = await openAt('/frameset.html');
  // frame-middle is nested inside frame-top — a page CSS selector can't reach it; only
  // the by-name Frame API pierces the tree. The gate should degrade automatically and grade ok.
  // Nested frames attach AFTER domcontentloaded, so poll until the target frame + its button are
  // actually present before grading (web-first wait, no fixed sleep) — otherwise the gate's
  // page.frame({name}) lookup races the frame attach and intermittently sees 0 elements.
  await expect
    .poll(async () => {
      const fr = page.frame({ name: 'frame-middle' });
      return fr ? await fr.getByRole('button', { name: 'Frame Submit' }).count() : 0;
    }, { timeout: 10_000 })
    .toBe(1);
  const p: any = { tier: 'role', role: 'button', name: 'Frame Submit', frame: 'frame[name="frame-middle"]' };
  const g = await gradeLocator(page, p);
  expect(g.ok).toBe(true);
  expect(g.frameDegraded).toBe(true);
  expect(g.degraded).toBe(true);
  expect(g.debt?.frame).toMatch(/legacy <frame>/);
  // render() reflects the degraded resolution gradeLocator stamped on the proposal.
  expect(render(p)).toBe(`page.frame({ name: 'frame-middle' }).getByRole('button', { name: 'Frame Submit' })`);
});

test('closed shadow DOM: unreachable by default (resolves to 0)', async () => {
  const page = await open(false);
  const g = await gradeLocator(page, { tier: 'role', role: 'button', name: 'Closed Shadow Btn' });
  expect(g.ok).toBe(false); // closed root is invisible to Playwright
});

test('closed shadow DOM: reachable when forceOpenShadow rewrites attachShadow', async () => {
  const page = await open(true);
  const g = await gradeLocator(page, { tier: 'role', role: 'button', name: 'Closed Shadow Btn' });
  expect(g.ok).toBe(true); // monkey-patch forced it open
});
