// Trace-driven self-healing (#0010, M5) — the documented next step for the page-based healer.
// When a spec fails because the live page grew AMBIGUOUS (two identical accessible targets), the
// flat page-based healer correctly refuses (no green-washing). The failure trace's DOM snapshot,
// captured when the locator still worked, holds the disambiguator: the intended element's accessible
// ANCESTOR scope (a named row/region). Recovering that scope and re-grading it through the gate
// resolves what the live page alone cannot — still gate-verified, still flagged needs-confirmation.
import { test, expect } from '@playwright/test';
import { chromium, Browser } from 'playwright';
import { healLocator, healFromTrace, extractTraceContext } from '../src/healer.mjs';

let browser: Browser;
test.beforeAll(async () => { browser = await chromium.launch({ channel: process.env.PW_CHANNEL }); });
test.afterAll(async () => { await browser?.close(); });

async function pageWith(html: string) {
  const p = await (await browser.newContext()).newPage();
  await p.setContent(html);
  return p;
}

// Live page NOW: the app grew a second row — two identical "Edit" links → the flat locator is ambiguous.
const LIVE = `<table>
  <tr role="row" aria-label="Acme Corp"><td><a href="#">Edit</a></td></tr>
  <tr role="row" aria-label="Globex Inc"><td><a href="#">Edit</a></td></tr>
</table>`;

// Trace snapshot, captured when the spec still passed: only the Acme row existed, so the intended
// "Edit" link is unambiguous here and its scope (row "Acme Corp") is recoverable.
const SNAPSHOT = `<table>
  <tr role="row" aria-label="Acme Corp"><td><a href="#">Edit</a></td></tr>
</table>`;

const BROKEN = { tier: 'role', role: 'link', name: 'Edit' };

test('page-based healer REFUSES: two identical "Edit" links, no unique accessible recovery', async () => {
  const p = await pageWith(LIVE);
  const r = await healLocator(p, { ...BROKEN });
  expect(r.healed).toBe(false);
  expect((r as any).reason).toMatch(/no unambiguous/);
});

test('extractTraceContext recovers the intended element\'s scope from the trace DOM snapshot', async () => {
  const snap = await pageWith(SNAPSHOT);
  const ctx = await extractTraceContext(snap, { ...BROKEN });
  expect(ctx.scope).toEqual({ role: 'row', name: 'Acme Corp' });
});

test('trace-driven heal RESOLVES what the page-based healer could not: scope to the trace\'s row', async () => {
  const p = await pageWith(LIVE);
  const r = await healFromTrace(p, { ...BROKEN }, { scope: { role: 'row', name: 'Acme Corp' } });
  expect(r.healed).toBe(true);
  expect(r.needsConfirmation).toBe(true);
  expect(r.tier).toBe('scoped');
  expect(r.locator).toBe("page.getByRole('row', { name: 'Acme Corp' }).getByRole('link', { name: 'Edit' })");
});

test('trace-driven heal still REFUSES when even the trace scope is not unique (no green-washing)', async () => {
  const p = await pageWith('<table><tr role="row" aria-label="Acme Corp"><td><a href="#">Edit</a><a href="#">Edit</a></td></tr></table>');
  const r = await healFromTrace(p, { ...BROKEN }, { scope: { role: 'row', name: 'Acme Corp' } });
  expect(r.healed).toBe(false);
});

test('trace-driven heal does NOT green-wash a still-resolving locator (nothing to heal)', async () => {
  const p = await pageWith('<a href="#">Edit</a>'); // unique on the live page
  const r = await healFromTrace(p, { ...BROKEN }, { scope: { role: 'row', name: 'Acme Corp' } });
  expect(r.healed).toBe(false);
  expect((r as any).reason).toMatch(/still resolves|nothing to heal/);
});

test('end-to-end: read trace snapshot → recover scope → re-grade on the live page → heal', async () => {
  const snap = await pageWith(SNAPSHOT);
  const ctx = await extractTraceContext(snap, { ...BROKEN });
  const p = await pageWith(LIVE);
  const r = await healFromTrace(p, { ...BROKEN }, ctx);
  expect(r.healed).toBe(true);
  expect(r.locator).toContain("getByRole('row', { name: 'Acme Corp' })");
});

// The canonical real-table case: rows named by their FIRST CELL TEXT, not aria-label (mirrors the
// gate's scopedCandidate). This is the case the scoped tier exists for.
const SNAPSHOT_CELLS = '<table><tr><td>Acme Corp</td><td><a href="#">Edit</a></td></tr></table>';
const LIVE_CELLS = '<table><tr><td>Acme Corp</td><td><a href="#">Edit</a></td></tr><tr><td>Globex Inc</td><td><a href="#">Edit</a></td></tr></table>';

test('extractTraceContext names a row by its first cell text when there is no aria-label', async () => {
  const snap = await pageWith(SNAPSHOT_CELLS);
  const ctx = await extractTraceContext(snap, { ...BROKEN });
  expect(ctx.scope).toEqual({ role: 'row', name: 'Acme Corp' });
});

test('trace-driven heal works on a cell-text-named table (the canonical scoped case)', async () => {
  const snap = await pageWith(SNAPSHOT_CELLS);
  const ctx = await extractTraceContext(snap, { ...BROKEN });
  const p = await pageWith(LIVE_CELLS);
  const r = await healFromTrace(p, { ...BROKEN }, ctx);
  expect(r.healed).toBe(true);
  expect(r.tier).toBe('scoped');
  expect(r.locator).toContain("getByRole('row', { name: 'Acme Corp' })");
});

test('extractTraceContext returns {} when the snapshot cannot pin the element (already ambiguous there)', async () => {
  const snap = await pageWith('<a href="#">Edit</a><a href="#">Edit</a>'); // two — count !== 1
  expect(await extractTraceContext(snap, { ...BROKEN })).toEqual({});
});

test('extractTraceContext returns {} when there is no named accessible ancestor', async () => {
  const snap = await pageWith('<div><span><a href="#">Edit</a></span></div>'); // no row/region/name
  expect(await extractTraceContext(snap, { ...BROKEN })).toEqual({});
});

test('trace-driven heal recovers a NAME drift via the corrected name (no scope needed)', async () => {
  // The link was authored as "Submit" but the live label drifted to "Save changes"; the trace carries
  // the corrected name. Only one link on the page → a flat corrected-name locator resolves.
  const p = await pageWith('<a href="#">Save changes</a>');
  const r = await healFromTrace(p, { tier: 'role', role: 'link', name: 'Submit' }, { name: 'Save changes' });
  expect(r.healed).toBe(true);
  expect(r.locator).toBe("page.getByRole('link', { name: 'Save changes' })");
});

test('trace-driven heal combines scope AND a corrected name when both are needed', async () => {
  // Two rows; the target link\'s name also drifted ("Edit" → "Modify"). Scope alone or name alone is
  // ambiguous/missing; together they resolve uniquely.
  const live = '<table><tr role="row" aria-label="Acme Corp"><td><a href="#">Modify</a></td></tr><tr role="row" aria-label="Globex Inc"><td><a href="#">Modify</a></td></tr></table>';
  const p = await pageWith(live);
  const r = await healFromTrace(p, { ...BROKEN }, { scope: { role: 'row', name: 'Acme Corp' }, name: 'Modify' });
  expect(r.healed).toBe(true);
  expect(r.locator).toContain("getByRole('row', { name: 'Acme Corp' }).getByRole('link', { name: 'Modify' })");
});
