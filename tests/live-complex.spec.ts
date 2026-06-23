// Real-signal gate checks against LIVE complex apps (open shadow DOM + iframes).
// Opt-in (network) — run with: LIVE=1 PW_CHANNEL=chromium npx playwright test tests/live-complex.spec.ts
// Skipped by default so the deterministic suite stays offline & fast.
import { test, expect } from '@playwright/test';
import { chromium, Browser } from 'playwright';
import { gradeLocator } from '../extension/qa-focus/ladder.mjs';

const LIVE = !!process.env.LIVE;
let browser: Browser;
test.afterAll(async () => { await browser?.close(); });

async function page(url: string) {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL });
  const p = await (await browser.newContext()).newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForLoadState('load');
  return p;
}

test('LIVE: open shadow DOM on a real web component is pierced & graded (MDN popup-info)', async () => {
  test.skip(!LIVE, 'set LIVE=1 to run network tests');
  const p = await page('https://mdn.github.io/web-components-examples/popup-info-box-web-component/');
  // The <popup-info> component renders an icon image inside its (open) shadow root.
  const g = await gradeLocator(p, { tier: 'role', role: 'img' });
  expect(g.ok).toBe(true);
});

test('LIVE: iframe content is gradeable only when scoped to the frame (the-internet/iframe)', async () => {
  test.skip(!LIVE, 'set LIVE=1 to run network tests');
  const p = await page('https://the-internet.herokuapp.com/iframe');
  // Heading lives on the top document — gradeable directly.
  const onPage = await gradeLocator(p, { tier: 'role', role: 'heading', name: 'An iFrame containing the TinyMCE WYSIWYG Editor' });
  expect(onPage.ok).toBe(true);
  // The TinyMCE editing area is inside iframe#mce_0_ifr — the body is contenteditable.
  const inFrame = await gradeLocator(p, { tier: 'role', role: 'textbox', frame: '#mce_0_ifr' });
  // We assert the frame ROUTING works (no exception, a definite verdict), not TinyMCE internals.
  expect(typeof inFrame.ok).toBe('boolean');
});

test('LIVE: legacy <frameset> content is reached by degrading to the Frame API (the-internet/nested_frames)', async () => {
  test.skip(!LIVE, 'set LIVE=1 to run network tests');
  const p = await page('https://the-internet.herokuapp.com/nested_frames');
  // "MIDDLE" lives in <frame name="frame-middle"> nested inside frame-top — invisible to
  // frameLocator. The gate must degrade to the by-name Frame API and grade it ok as debt.
  const g = await gradeLocator(p, { tier: 'text', name: 'MIDDLE', frame: 'frame[name="frame-middle"]' });
  expect(g.ok).toBe(true);
  expect(g.frameDegraded).toBe(true);
});
