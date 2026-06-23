// Purpose-built DOM snapshot store (#0020, ADR 0009). The trace-driven healer recovers a broken
// locator from the page's pre-failure DOM; rather than parse Playwright's internal trace-snapshot
// format, the explorer persists each pre-action DOM here as loadable HTML. These tests assert the
// store writes loadable HTML, tracks the latest path, and never throws on a bad page.
import { test, expect } from '@playwright/test';
import { chromium, Browser } from 'playwright';
import { readFileSync } from 'node:fs';
import { createSnapshotStore } from '../src/snapshot-store.mjs';

let browser: Browser;
test.beforeAll(async () => { browser = await chromium.launch({ channel: process.env.PW_CHANNEL }); });
test.afterAll(async () => { await browser?.close(); });

test('capture writes loadable HTML and tracks the latest path', async ({}, testInfo) => {
  const store = createSnapshotStore(testInfo.outputPath('snapshots'));
  expect(store.latest()).toBeNull();

  const p = await (await browser.newContext()).newPage();
  await p.setContent('<table><tr role="row" aria-label="Acme Corp"><td><a href="#">Edit</a></td></tr></table>');
  const path = await store.capture(p, 'before-click-e5');
  expect(path).toBeTruthy();
  expect(path).toBe(store.latest());
  expect(path).toMatch(/0001-before-click-e5\.html$/);

  // The captured file is the live DOM and is loadable back into a fresh page.
  const html = readFileSync(path as string, 'utf8');
  expect(html).toContain('aria-label="Acme Corp"');
  const back = await (await browser.newContext()).newPage();
  await back.setContent(html);
  await expect(back.getByRole('row', { name: 'Acme Corp' })).toHaveCount(1);
});

test('capture increments and slugifies labels; latest follows the newest', async ({}, testInfo) => {
  const store = createSnapshotStore(testInfo.outputPath('snapshots'));
  const p = await (await browser.newContext()).newPage();
  await p.setContent('<main>one</main>');
  const a = await store.capture(p, 'step one!');
  await p.setContent('<main>two</main>');
  const b = await store.capture(p);
  expect(a).toMatch(/0001-step-one\.html$/);
  expect(b).toMatch(/0002-step\.html$/); // no label → default slug
  expect(store.latest()).toBe(b);
});

test('capture never throws — a closed page yields null, not an exception', async ({}, testInfo) => {
  const store = createSnapshotStore(testInfo.outputPath('snapshots'));
  const p = await (await browser.newContext()).newPage();
  await p.close();
  const path = await store.capture(p, 'after-close');
  expect(path).toBeNull();
  expect(store.latest()).toBeNull();
});
