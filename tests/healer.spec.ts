// Self-healing locator recovery (M5) — deterministic, gate-verified, and CONSERVATIVE:
// it recovers a drifted locator only when the gate cleanly accepts a unique candidate,
// and refuses (no silent green-washing) when recovery would be a guess.
import { test, expect } from '@playwright/test';
import { chromium, Browser } from 'playwright';
import { healLocator } from '../src/healer.mjs';

let browser: Browser;
test.beforeAll(async () => { browser = await chromium.launch({ channel: process.env.PW_CHANNEL }); });
test.afterAll(async () => { await browser?.close(); });

async function pageWith(html: string) {
  const p = await (await browser.newContext()).newPage();
  await p.setContent(html);
  return p;
}

test('heals a NAME drift: the only button got relabelled → role-only locator', async () => {
  const p = await pageWith('<button>Save</button>'); // was named "Submit"
  const r = await healLocator(p, { tier: 'role', role: 'button', name: 'Submit' });
  expect(r.healed).toBe(true);
  expect(r.needsConfirmation).toBe(true);
  expect(r.proposal).toEqual({ tier: 'role', role: 'button' });
  expect(r.locator).toBe("page.getByRole('button')");
});

test('heals a ROLE drift: name stable, <button> became <a> → role:link with the same name', async () => {
  const p = await pageWith('<a href="#">Download</a>'); // was a button named "Download"
  const r = await healLocator(p, { tier: 'role', role: 'button', name: 'Download' });
  expect(r.healed).toBe(true);
  expect(r.proposal).toEqual({ tier: 'role', role: 'link', name: 'Download' });
  expect(r.locator).toBe("page.getByRole('link', { name: 'Download' })");
});

test('REFUSES to heal when recovery is ambiguous (two buttons, target name gone)', async () => {
  const p = await pageWith('<button>Save</button><button>Cancel</button>');
  const r = await healLocator(p, { tier: 'role', role: 'button', name: 'Submit' });
  expect(r.healed).toBe(false); // role-only is not unique, name/text not found → no guess
  expect((r as any).reason).toMatch(/no unambiguous/);
});

test('does NOT green-wash a working locator (nothing to heal)', async () => {
  const p = await pageWith('<button>Save</button>');
  const r = await healLocator(p, { tier: 'role', role: 'button', name: 'Save' });
  expect(r.healed).toBe(false);
  expect((r as any).reason).toMatch(/still resolves|nothing to heal/);
});
