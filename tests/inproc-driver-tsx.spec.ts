// Regression guard for the in-process driver under the REAL runtime (#0026).
//
// The explorer/codifier run through the `tsx` (esbuild) loader, which decorates named functions
// inside `page.evaluate` callbacks with `__name(...)` — a helper that exists only in module scope,
// not in the page's browser context. The in-process driver's `snapshotPage` therefore threw
// `ReferenceError: __name is not defined` at runtime on every no-CDP surface (Electron), even
// though `tests/inproc-driver.spec.ts` passed (Playwright's transform doesn't inject `__name`).
// A live Electron explore run surfaced it. This test runs the driver through the same `tsx` loader
// the binaries use, so the regression cannot silently return.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PROBE = join(dirname(fileURLToPath(import.meta.url)), 'helpers/inproc-tsx-probe.mts');

test('in-process driver snapshot works under the tsx/esbuild loader (no __name ReferenceError)', () => {
  const stdout = execFileSync(process.execPath, ['--import', 'tsx', PROBE], { encoding: 'utf8' });
  const result = JSON.parse(stdout) as { ok: boolean; out: string };
  expect(result.ok, `snapshot failed under tsx: ${result.out}`).toBe(true);
  // Sanity: the snapshot must actually advertise the page's actionable elements by ref.
  expect(result.out).toMatch(/button "Add" \[ref=e\d+\]/);
  expect(result.out).toMatch(/textbox "New task" \[ref=e\d+\]/);
});
