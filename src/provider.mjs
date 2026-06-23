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
import { existsSync } from 'node:fs';

/** Poll a CDP http endpoint until /json/version answers (the browser is ready to attach). */
async function waitForCdp(endpoint, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const v = await fetch(`${endpoint}/json/version`).then((r) => r.json());
      if (v.webSocketDebuggerUrl) return endpoint;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`CDP endpoint ${endpoint} did not come up within ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Force every shadow root OPEN before any document script runs. Playwright (and the
 * accessibility snapshot) cannot pierce CLOSED shadow roots — common in enterprise
 * web-component apps (e.g. Salesforce LWC). Monkey-patching attachShadow makes their
 * content reachable to the gate and the tools. Off by default (it changes app
 * behavior); enable only when you must test inside closed components.
 */
function forceOpenShadowInit() {
  const orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    return orig.call(this, { ...init, mode: 'open' });
  };
}

export async function openSurface({ kind = 'web', electronArgs = [], cdpUrl, channel, cdpPort, headless = true, slowMo, forceOpenShadow = false, storageState } = {}) {
  if (kind === 'web') {
    // Expose a CDP http endpoint so the @playwright/cli (the model's action surface)
    // can attach to the very same browser our in-process gate/evidence/allowlist watch.
    const args = cdpPort ? [`--remote-debugging-port=${cdpPort}`] : [];
    const browser = await chromium.launch({ channel, args, headless, slowMo });
    // storageState reuses a previously-captured login (cookies + localStorage) so
    // authenticated flows don't re-login every run. Only load it when the file exists
    // (Playwright throws on a missing path); first run logs in, then saveState() writes it.
    const useState = storageState && existsSync(storageState) ? storageState : undefined;
    const context = await browser.newContext(useState ? { storageState: useState } : {});
    if (forceOpenShadow) await context.addInitScript(forceOpenShadowInit);
    const page = await context.newPage();
    const cdpEndpoint = cdpPort ? await waitForCdp(`http://127.0.0.1:${cdpPort}`) : undefined;
    return {
      kind, context, page, cdpEndpoint,
      loadedState: !!useState,
      saveState: (path) => context.storageState({ path }),
      close: () => browser.close(),
    };
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
    // OpenFin's RVM already exposes this CDP endpoint — the CLI attaches to the same one.
    return { kind, context, page, browser, cdpEndpoint: cdpUrl, close: () => browser.close() };
  }
  throw new Error(`unknown surface kind: ${kind}`);
}
