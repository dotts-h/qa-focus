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
import type { Browser, BrowserContext, ElectronApplication, Page } from 'playwright';
import { existsSync } from 'node:fs';

/** The supported browser surfaces. */
export type SurfaceKind = 'web' | 'electron' | 'openfin';

/** An opened surface: a live Page + context plus surface-specific lifecycle handles. */
export interface Surface {
  kind: string;
  context: BrowserContext;
  page: Page;
  cdpEndpoint?: string;
  loadedState?: boolean;
  saveState?: (path: string) => Promise<unknown>;
  electronApp?: ElectronApplication;
  browser?: Browser;
  close: () => Promise<void>;
}

/** Match an OpenFin/CDP window by URL and/or title (substring or RegExp). When BOTH are given,
 *  a window must match BOTH (AND). */
export interface WindowMatch {
  url?: string | RegExp;
  title?: string | RegExp;
}

/** Options for `openSurface` — a superset across all surface kinds. */
export interface OpenSurfaceOptions {
  kind?: string;
  electronArgs?: string[];
  cdpUrl?: string;
  channel?: string;
  cdpPort?: number;
  headless?: boolean;
  slowMo?: number;
  forceOpenShadow?: boolean;
  storageState?: string;
  /** openfin only: pick a specific window (else the first one). */
  window?: WindowMatch;
}

const matches = (value: string, m: string | RegExp): boolean =>
  typeof m === 'string' ? value.includes(m) : m.test(value);

/**
 * Every window across all contexts of a CDP-connected browser. OpenFin surfaces an app's
 * windows as Pages spread across contexts; a flat list is the basis for selecting among them.
 */
export function listWindows(browser: Browser): Page[] {
  return browser.contexts().flatMap((c) => c.pages());
}

/**
 * OpenFin's own provider/platform windows — NOT the app under test. A real RVM always opens an
 * internal `openfin-internal://blank` provider window (often FIRST in the page list), so a naive
 * "first window" default drives the wrong one (verified live, #0024/#0002). These are skipped when
 * picking a default window; an explicit `window` matcher can still select any window.
 */
export function isInternalWindow(url: string): boolean {
  return !url
    || url === 'about:blank'
    || url.startsWith('openfin-internal:')
    || url.startsWith('chrome://')
    || url.startsWith('devtools://');
}

/** The first real APP window (skipping OpenFin's internal windows); falls back to the first window
 *  of any kind when every window is internal, so attach never returns nothing on an odd RVM state. */
export function firstAppWindow(browser: Browser): Page | undefined {
  const pages = listWindows(browser);
  return pages.find((p) => !isInternalWindow(p.url())) ?? pages[0];
}

/**
 * The first window whose url and/or title match (both must match when both are given) — for
 * picking a specific OpenFin window when an app opens several. Returns `undefined` (never a wrong
 * window) when nothing matches. A window that throws while being inspected (mid-close/crashed on a
 * live RVM) is skipped, not fatal — so transient window churn can't abort the whole attach.
 */
export async function pickWindow(browser: Browser, match: WindowMatch): Promise<Page | undefined> {
  for (const p of listWindows(browser)) {
    try {
      if (match.url && !matches(p.url(), match.url)) continue;
      if (match.title && !matches(await p.title(), match.title)) continue;
      return p;
    } catch { /* window closing/crashed — skip it and try the next */ }
  }
  return undefined;
}

/** Poll a CDP http endpoint until /json/version answers (the browser is ready to attach). */
async function waitForCdp(endpoint: string, timeoutMs = 5000): Promise<string> {
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
function forceOpenShadowInit(): void {
  const orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init: ShadowRootInit) {
    return orig.call(this, { ...init, mode: 'open' });
  };
}

export async function openSurface(
  { kind = 'web', electronArgs = [], cdpUrl, channel, cdpPort, headless = true, slowMo, forceOpenShadow = false, storageState, window }: OpenSurfaceOptions = {},
): Promise<Surface> {
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
      saveState: (path: string) => context.storageState({ path }),
      close: () => browser.close(),
    };
  }
  if (kind === 'electron') {
    // NOTE: electronArgs must point at the app DIRECTORY (a folder with package.json "main"),
    // NOT a bare main.js path — Electron does not treat a lone .js file as the app entry, so
    // the app never starts and firstWindow() hangs (see docs/REGRESSIONS.md #1). On headless
    // Linux/CI also pass '--no-sandbox' and launch under xvfb.
    const app = await _electron.launch({ args: electronArgs });
    const page = await app.firstWindow();
    return { kind, context: page.context(), page, electronApp: app, close: () => app.close() };
  }
  if (kind === 'openfin') {
    if (!cdpUrl) throw new Error('openfin surface needs cdpUrl (e.g. http://localhost:9222) — start the RVM with --remote-debugging-port first');
    const browser = await chromium.connectOverCDP(cdpUrl);
    // Pick the requested window when an app opens several; else the first existing window.
    const picked = window ? await pickWindow(browser, window) : undefined;
    // A mis-specified matcher would otherwise silently drive the WRONG window — make it diagnosable.
    if (window && !picked) console.warn(`[qa-focus] openfin window matcher ${JSON.stringify(window)} matched no window — falling back to the first app window.`);
    // Default (no matcher): the first APP window, skipping OpenFin's internal provider window
    // (openfin-internal://blank), which a real RVM lists first — verified live (#0024).
    const page = picked
      ?? firstAppWindow(browser)
      ?? (await (browser.contexts()[0] ?? (await browser.newContext())).newPage());
    const context = page.context();
    // OpenFin's RVM already exposes this CDP endpoint — the CLI attaches to the same one.
    return { kind, context, page, browser, cdpEndpoint: cdpUrl, close: () => browser.close() };
  }
  throw new Error(`unknown surface kind: ${kind}`);
}
