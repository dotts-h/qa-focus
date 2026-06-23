// In-process action driver — the Electron (and any no-CDP surface) answer to ADR 0001's
// CLI model. The autonomous explorer/codifier drive the browser through @playwright/cli,
// which attaches over a CDP http endpoint (src/pwcli.mts). Electron exposes no such
// endpoint (`_electron.launch` gives Playwright a Page, not an attachable CDP url), so the
// CLI cannot reach it. This driver implements the SAME `PwCli` shape — `cmd('snapshot' |
// 'goto' | 'click' | 'fill' | 'press')` returning `{ ok, out }` — but acts on the live
// Playwright `Page` directly. Because the gated browser tools (src/browser-tools.mts) and
// the locator gate only ever call that interface, the leash and the gate stay UNCHANGED:
// swapping the action backend is all Electron support takes (ADR 0005).
//
// The snapshot tags each actionable element with a `data-qaf-ref` attribute and emits the
// same `- <role> "<name>" [ref=eN]` lines the CLI does, so `parseSnapshotRefs` (flow.mts)
// and the by-ref actions work identically. It needs only a Playwright Page, so it is
// surface-agnostic (Electron windows ARE Pages) and unit-testable on plain chromium.
import type { Page, Locator } from 'playwright';
import type { PwCli, CliResult, BrowserCtx } from './pwcli.mjs';

const ACTION_TIMEOUT = 10_000;

/** One snapshot entry: the durable accessible identity behind a ref. */
interface SnapshotNode {
  ref: string;
  role: string;
  name: string;
}

/**
 * Tag every actionable/landmark element with `data-qaf-ref` and return its ref + inferred
 * accessible role + name (in document order). Runs in the page; mirrors the role/name
 * precedence the locator gate uses, so the model sees the same vocabulary it must propose.
 */
async function snapshotPage(page: Page): Promise<SnapshotNode[]> {
  return await page.evaluate(() => {
    const SEL = 'a[href], button, input, textarea, select, summary, [role], [contenteditable=""], [contenteditable="true"], h1, h2, h3, h4, h5, h6, li';
    const roleOf = (el: Element): string | null => {
      const explicit = el.getAttribute('role');
      if (explicit) return explicit.trim().split(/\s+/)[0];
      const tag = el.tagName.toLowerCase();
      if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
      if (tag === 'button' || tag === 'summary') return 'button';
      if (tag === 'input') {
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        if (['button', 'submit', 'reset', 'image'].includes(t)) return 'button';
        if (t === 'checkbox') return 'checkbox';
        if (t === 'radio') return 'radio';
        if (['', 'text', 'email', 'search', 'tel', 'url', 'password', 'number'].includes(t)) return 'textbox';
        return null;
      }
      if (tag === 'textarea') return 'textbox';
      if (tag === 'select') return 'combobox';
      if (/^h[1-6]$/.test(tag)) return 'heading';
      if (tag === 'li') return 'listitem';
      if ((el as HTMLElement).isContentEditable) return 'textbox';
      return null;
    };
    const nameOf = (el: Element): string => {
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const lb = el.getAttribute('aria-labelledby');
      if (lb) {
        const t = lb.split(/\s+/).map((id) => (document.getElementById(id)?.textContent || '').trim()).filter(Boolean).join(' ');
        if (t) return t;
      }
      try {
        const labels = (el as HTMLInputElement).labels;
        if (labels && labels[0]) { const t = (labels[0].textContent || '').trim(); if (t) return t; }
      } catch { /* not labelable */ }
      const tag = el.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        const ph = el.getAttribute('placeholder'); if (ph && ph.trim()) return ph.trim();
        const ti = el.getAttribute('title'); if (ti && ti.trim()) return ti.trim();
        return '';
      }
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt) return txt.slice(0, 80);
      const alt = el.getAttribute('alt'); if (alt && alt.trim()) return alt.trim();
      const ti = el.getAttribute('title'); if (ti && ti.trim()) return ti.trim();
      return '';
    };
    const out: SnapshotNode[] = [];
    let n = 0;
    for (const el of Array.from(document.querySelectorAll(SEL))) {
      // Skip elements the user can't perceive/act on (collapsed, display:none, etc.).
      const visible = typeof (el as { checkVisibility?: () => boolean }).checkVisibility === 'function'
        ? (el as { checkVisibility: () => boolean }).checkVisibility()
        : true;
      if (!visible) continue;
      const role = roleOf(el);
      if (!role) continue;
      const ref = 'e' + (++n);
      el.setAttribute('data-qaf-ref', ref);
      out.push({ ref, role, name: nameOf(el) });
    }
    return out;
  });
}

/** Resolve the element a ref points at (tagged by the latest snapshot). */
function byRef(page: Page, ref: string): Locator {
  // The ref token is `e<digits>` (we mint it); guard anyway so a hostile value can't break out.
  const safe = /^[A-Za-z0-9]+$/.test(ref) ? ref : '';
  return page.locator(`[data-qaf-ref="${safe}"]`);
}

/**
 * Attach an in-process driver to an already-open Page and return the per-call context the
 * gated browser tools expect — the no-CDP counterpart of `attachCli` (src/pwcli.mts).
 */
export async function attachInProcess(
  { page, session = 'qa-focus-inproc' }: { page: Page; session?: string },
): Promise<{ pwcli: PwCli; getCtx: () => Promise<BrowserCtx> }> {
  const ok = (out = ''): CliResult => ({ ok: true, out });
  const fail = (out: string): CliResult => ({ ok: false, out });

  const cmd = async (...args: string[]): Promise<CliResult> => {
    const [sub, ...rest] = args;
    try {
      switch (sub) {
        case 'snapshot': {
          // `--depth` (a CLI nicety for trimming huge trees) is N/A for this flat actionable
          // list — accepted and ignored so the tool's call shape stays identical.
          const nodes = await snapshotPage(page);
          const text = nodes
            .map((d) => `- ${d.role}${d.name ? ` "${d.name}"` : ''} [ref=${d.ref}]`)
            .join('\n');
          return ok(text || '(no actionable elements)');
        }
        case 'goto': {
          const url = rest[0];
          if (!url) return fail('goto: missing url');
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          return ok(`at ${url}`);
        }
        case 'click': {
          const loc = byRef(page, rest[0] ?? '');
          if ((await loc.count()) !== 1) return fail(`click: ref "${rest[0]}" resolves to ${await loc.count()} elements (re-snapshot)`);
          await loc.click({ timeout: ACTION_TIMEOUT });
          return ok('clicked');
        }
        case 'fill': {
          const [ref, text, ...flags] = rest;
          const loc = byRef(page, ref ?? '');
          if ((await loc.count()) !== 1) return fail(`fill: ref "${ref}" resolves to ${await loc.count()} elements (re-snapshot)`);
          await loc.fill(text ?? '', { timeout: ACTION_TIMEOUT });
          if (flags.includes('--submit')) await loc.press('Enter');
          return ok('filled');
        }
        case 'press': {
          const key = rest[0];
          if (!key) return fail('press: missing key');
          await page.keyboard.press(key);
          return ok('pressed');
        }
        default:
          return fail(`in-process driver: unsupported command "${sub}"`);
      }
    } catch (e) {
      return fail(`${sub} failed: ${(e as Error)?.message || e}`);
    }
  };

  const pwcli: PwCli = {
    session,
    attach: async () => ok(), // no CDP attach — the Page is already in-hand
    cmd,
    detach: async () => ok(), // nothing to detach; lifecycle is the surface's (provider.close)
  };
  return { pwcli, getCtx: async () => ({ page, pwcli }) };
}
