// The IN-PROCESS action driver (issue #0004, ADR 0005) — proves the explorer/codifier can
// drive a surface that has NO CDP endpoint (Electron) by acting on the Playwright Page
// directly, behind the SAME PwCli-shaped interface the gated browser tools already call.
//
// Deterministic on chromium: the driver only needs a Playwright `Page`, so we exercise it
// here with no Electron binary, no display, and no model/quota — a real signal in the
// offline suite. (The real-Electron-surface proof is the opt-in ELECTRON_LIVE test in
// tests/live-electron.spec.ts.)
import { test, expect, chromium } from '@playwright/test';
import type { Browser, Page } from 'playwright';
import { attachInProcess } from '../src/inproc-driver.mjs';
import { parseSnapshotRefs } from '../src/flow.mjs';

// Mirrors fixtures/electron/index.html, plus a tiny submit handler so actions have an
// observable effect to assert on (the Electron fixture is static; here we want a result).
const HTML = `<!doctype html><html lang="en"><body>
  <h1>Todo</h1>
  <form id="add-form">
    <label>New task <input id="new-task" name="task" required /></label>
    <button type="submit">Add</button>
  </form>
  <ul id="list" aria-label="tasks"></ul>
  <script>
    document.getElementById('add-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = document.getElementById('new-task').value.trim();
      if (!v) return;
      const li = document.createElement('li');
      li.textContent = v;
      document.getElementById('list').appendChild(li);
      document.getElementById('new-task').value = '';
    });
  </script>
</body></html>`;

let browser: Browser;
test.beforeAll(async () => { browser = await chromium.launch({ channel: process.env.PW_CHANNEL }); });
test.afterAll(async () => { await browser.close(); });

async function fresh(): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent(HTML);
  return page;
}

/** Find the ref the snapshot assigned to a given role+name (substring match on name). */
function refFor(out: string, role: string, namePart: RegExp): string {
  for (const [ref, v] of parseSnapshotRefs(out)) {
    if (v.role === role && namePart.test(v.name)) return ref;
  }
  return '';
}

test('snapshot emits refs the flow parser can read (role + accessible name)', async () => {
  const page = await fresh();
  const { pwcli, getCtx } = await attachInProcess({ page });
  const snap = await pwcli.cmd('snapshot');
  expect(snap.ok).toBe(true);
  expect(snap.out).toMatch(/\[ref=e\d+\]/);
  expect(refFor(snap.out, 'button', /Add/)).toBeTruthy();
  expect(refFor(snap.out, 'textbox', /New task/)).toBeTruthy();
  // getCtx returns the same page + driver the gated tools expect.
  const ctx = await getCtx();
  expect(ctx.page).toBe(page);
  expect(ctx.pwcli).toBe(pwcli);
  await page.close();
});

test('fill + click act on the element behind the ref', async () => {
  const page = await fresh();
  const { pwcli } = await attachInProcess({ page });
  const out = (await pwcli.cmd('snapshot')).out;
  const taskRef = refFor(out, 'textbox', /New task/);
  const addRef = refFor(out, 'button', /Add/);
  expect(taskRef && addRef).toBeTruthy();

  expect((await pwcli.cmd('fill', taskRef, 'buy milk')).ok).toBe(true);
  expect((await pwcli.cmd('click', addRef)).ok).toBe(true);
  await expect(page.getByRole('listitem').filter({ hasText: 'buy milk' })).toBeVisible();
  await page.close();
});

test('fill --submit presses Enter (no separate click needed)', async () => {
  const page = await fresh();
  const { pwcli } = await attachInProcess({ page });
  const taskRef = refFor((await pwcli.cmd('snapshot')).out, 'textbox', /New task/);
  expect((await pwcli.cmd('fill', taskRef, 'walk dog', '--submit')).ok).toBe(true);
  await expect(page.getByRole('listitem').filter({ hasText: 'walk dog' })).toBeVisible();
  await page.close();
});

test('press routes a keypress to the page', async () => {
  const page = await fresh();
  const { pwcli } = await attachInProcess({ page });
  const taskRef = refFor((await pwcli.cmd('snapshot')).out, 'textbox', /New task/);
  await pwcli.cmd('fill', taskRef, 'feed cat');
  expect((await pwcli.cmd('press', 'Enter')).ok).toBe(true);
  await expect(page.getByRole('listitem').filter({ hasText: 'feed cat' })).toBeVisible();
  await page.close();
});

test('a stale/unknown ref fails cleanly (ok:false) — never throws', async () => {
  const page = await fresh();
  const { pwcli } = await attachInProcess({ page });
  await pwcli.cmd('snapshot');
  const r = await pwcli.cmd('click', 'e9999');
  expect(r.ok).toBe(false);
  expect(r.out).toBeTruthy();
  await page.close();
});

test('detach is a safe no-op for the in-process driver', async () => {
  const page = await fresh();
  const { pwcli } = await attachInProcess({ page });
  expect((await pwcli.detach()).ok).toBe(true);
  await page.close();
});

test('re-snapshot clears the ref of an element dropped from the new snapshot (no stale residue)', async () => {
  const page = await fresh();
  const { pwcli } = await attachInProcess({ page });
  await pwcli.cmd('snapshot'); // tags the Add button
  expect(await page.locator('button[type=submit][data-qaf-ref]').count()).toBe(1);
  // Hide the button — it stays in the DOM but drops out of the next snapshot.
  await page.evaluate(() => { (document.querySelector('button[type="submit"]') as HTMLElement).style.visibility = 'hidden'; });
  await pwcli.cmd('snapshot');
  // Its stale ref must be gone, not left attached to a now-unadvertised element.
  expect(await page.locator('button[type=submit][data-qaf-ref]').count()).toBe(0);
  await page.close();
});

test('input roles match the ARIA role Playwright assigns (number→spinbutton, search→searchbox)', async () => {
  const page = await browser.newPage();
  await page.setContent('<input type="number" aria-label="Qty"><input type="search" aria-label="Find"><input type="email" aria-label="Mail">');
  const { pwcli } = await attachInProcess({ page });
  const refs = parseSnapshotRefs((await pwcli.cmd('snapshot')).out);
  const roles = [...refs.values()];
  expect(roles.some((r) => r.role === 'spinbutton' && r.name === 'Qty')).toBe(true);
  expect(roles.some((r) => r.role === 'searchbox' && r.name === 'Find')).toBe(true);
  expect(roles.some((r) => r.role === 'textbox' && r.name === 'Mail')).toBe(true);
  // and those advertised roles actually resolve on the live page (the gate would accept them)
  await expect(page.getByRole('spinbutton', { name: 'Qty' })).toHaveCount(1);
  await page.close();
});
