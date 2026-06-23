// Probe: run the in-process driver's snapshot through the SAME runtime the explorer/codifier
// use — the `tsx` (esbuild) loader — not the Playwright test transform. esbuild decorates the
// named functions inside `snapshotPage`'s `page.evaluate` callback with `__name(...)` calls;
// that helper lives in module scope, NOT in the page's browser context where the callback runs,
// so an unguarded driver throws `ReferenceError: __name is not defined` at snapshot time on
// EVERY surface that uses the in-process path (Electron + any no-CDP surface). This regressed
// silently because the unit tests run under Playwright's transform, which doesn't inject `__name`.
// The probe reproduces the real runtime on plain headless chromium (the bug is transpile-driven,
// not Electron-specific) and prints a one-line JSON verdict for tests/inproc-driver-tsx.spec.ts.
import { chromium } from 'playwright';
import { attachInProcess } from '../../src/inproc-driver.mjs';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<h1>Todo</h1><button type="button">Add</button><input aria-label="New task" />');
  const { pwcli } = await attachInProcess({ page });
  const snap = await pwcli.cmd('snapshot');
  process.stdout.write(JSON.stringify({ ok: snap.ok, out: snap.out }));
} finally {
  await browser.close();
}
