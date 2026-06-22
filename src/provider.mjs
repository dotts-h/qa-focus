// Browser-surface provider — the seam that makes the gate/tools work across web,
// Electron, and OpenFin. All three are Chromium under the hood and Playwright
// speaks CDP to all of them, so the locator gate, evidence, and allowlist (which
// operate on a Page) are unchanged; only the launcher differs.
//
//   web      chromium.launch()                          — a normal browser
//   electron _electron.launch({ args:[main] })          — windows are Pages;
//                                                          electronApp.evaluate()
//                                                          reaches the main process.
//                                                          Must control lifecycle
//                                                          (cannot attach to an
//                                                          already-running instance).
//   openfin  chromium.connectOverCDP(cdpUrl)            — launch the RVM yourself
//                                                          with --remote-debugging-port,
//                                                          poll until it's up, then
//                                                          windows appear as pages.
import { chromium, _electron } from 'playwright';

export async function openSurface({ kind = 'web', electronArgs = [], cdpUrl, channel } = {}) {
  if (kind === 'web') {
    const browser = await chromium.launch({ channel });
    const context = await browser.newContext();
    const page = await context.newPage();
    return { kind, context, page, close: () => browser.close() };
  }
  if (kind === 'electron') {
    const app = await _electron.launch({ args: electronArgs });
    const page = await app.firstWindow();
    return { kind, context: page.context(), page, electronApp: app, close: () => app.close() };
  }
  if (kind === 'openfin') {
    if (!cdpUrl) throw new Error('openfin surface needs cdpUrl (e.g. http://localhost:9222) — start the RVM with --remote-debugging-port first');
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    return { kind, context, page, browser, close: () => browser.close() };
  }
  throw new Error(`unknown surface kind: ${kind}`);
}
