// Trace-driven heal wired to a real artifact (#0020, ADR 0009). The page-based healer refuses when
// the LIVE page grew ambiguous (two identical accessible targets). `healFromSnapshot` recovers the
// disambiguator from a purpose-built DOM snapshot the explorer captured BEFORE the failure (when the
// locator still resolved), then re-grades on the live page — still gate-verified, still refusing
// (no green-washing) when even the snapshot can't disambiguate. This exercises the full path through
// a file on disk (the store's output), not a hand-loaded Page.
import { test, expect } from '@playwright/test';
import { chromium, Browser } from 'playwright';
import { createSnapshotStore } from '../src/snapshot-store.mjs';
import { healFromSnapshot } from '../src/healer.mjs';

let browser: Browser;
test.beforeAll(async () => { browser = await chromium.launch({ channel: process.env.PW_CHANNEL }); });
test.afterAll(async () => { await browser?.close(); });

// LIVE page NOW: a second row appeared — two identical "Edit" links → the flat locator is ambiguous.
const LIVE = `<table>
  <tr role="row" aria-label="Acme Corp"><td><a href="#">Edit</a></td></tr>
  <tr role="row" aria-label="Globex Inc"><td><a href="#">Edit</a></td></tr>
</table>`;
// The state captured BEFORE the failing step: only the Acme row existed, so "Edit" is unambiguous.
const SNAPSHOT = `<table>
  <tr role="row" aria-label="Acme Corp"><td><a href="#">Edit</a></td></tr>
</table>`;
const BROKEN = { tier: 'role', role: 'link', name: 'Edit' };

async function captureSnapshot(html: string, dir: string): Promise<string> {
  const store = createSnapshotStore(dir);
  const p = await (await browser.newContext()).newPage();
  await p.setContent(html);
  const path = await store.capture(p, 'before-click-e5');
  return path as string;
}

test('heals from a captured snapshot file: scope to the trace\'s row, gate-verified', async ({}, testInfo) => {
  const snapPath = await captureSnapshot(SNAPSHOT, testInfo.outputPath('snapshots'));
  const live = await (await browser.newContext()).newPage();
  await live.setContent(LIVE);

  const r = await healFromSnapshot(live, { ...BROKEN }, snapPath);
  expect(r.healed).toBe(true);
  expect((r as any).needsConfirmation).toBe(true);
  expect((r as any).tier).toBe('scoped');
  expect((r as any).locator).toBe("page.getByRole('row', { name: 'Acme Corp' }).getByRole('link', { name: 'Edit' })");
});

test('still REFUSES when the snapshot itself can\'t disambiguate (no green-washing)', async ({}, testInfo) => {
  // The snapshot already had two "Edit" links → no unique scope to recover.
  const ambiguous = '<table><tr role="row" aria-label="Acme Corp"><td><a href="#">Edit</a><a href="#">Edit</a></td></tr></table>';
  const snapPath = await captureSnapshot(ambiguous, testInfo.outputPath('snapshots'));
  const live = await (await browser.newContext()).newPage();
  await live.setContent(LIVE);

  const r = await healFromSnapshot(live, { ...BROKEN }, snapPath);
  expect(r.healed).toBe(false);
});

test('a missing snapshot file is a refusal, not a crash', async () => {
  const live = await (await browser.newContext()).newPage();
  await live.setContent(LIVE);
  const r = await healFromSnapshot(live, { ...BROKEN }, '/no/such/snapshot.html');
  expect(r.healed).toBe(false);
  expect((r as any).reason).toMatch(/not readable/);
});
