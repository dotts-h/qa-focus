// The enforced Playwright locator-priority ladder — the deterministic gate.
//
// Priority (playwright.dev/docs/locators), highest first:
//   1 role  2 label  3 placeholder  4 text  5 altText  6 title  7 testid
//   8 scoped  ← an accessible parent + accessible child, e.g.
//               getByRole('row',{name:'…'}).getByRole('link',{name:'edit'})
//               Playwright's preferred disambiguation when a flat accessible
//               name is not unique. Still fully accessible → NOT debt.
//   9 css / 10 xpath  ← last resort: allowed ONLY when nothing above resolves,
//               and only with a written reason (logged as accessibility debt).
//
// The gate never trusts what the agent CLAIMS. Given a proposal that resolves to
// exactly one element, it re-derives higher-priority alternatives FROM that
// element — flat accessible locators AND a scoped accessible locator (for the
// common table-row case) — and rejects the proposal if any uniquely resolves
// the same node. Lazy CSS is bounced toward role, or toward a row-scoped
// accessible locator; genuine no-handle elements still degrade to logged CSS.

export const TIERS = ['role', 'label', 'placeholder', 'text', 'altText', 'title', 'testid', 'scoped', 'css', 'xpath'];
export const DEGRADED = new Set(['css', 'xpath']);

/** Build a Playwright Locator from a proposal, rooted at `root` (a Page or Locator). */
export function buildLocator(root, p) {
  if (p.scope) {
    const scopeLoc = buildLocator(root, p.scope);
    return buildLocator(scopeLoc, { ...p, scope: undefined });
  }
  const opt = p.exact === undefined ? undefined : { exact: p.exact };
  switch (p.tier) {
    case 'role':        return root.getByRole(p.role, p.name ? { name: p.name, ...(opt || {}) } : undefined);
    case 'label':       return root.getByLabel(p.name, opt);
    case 'placeholder': return root.getByPlaceholder(p.name, opt);
    case 'text':        return root.getByText(p.name, opt);
    case 'altText':     return root.getByAltText(p.name, opt);
    case 'title':       return root.getByTitle(p.name, opt);
    case 'testid':      return root.getByTestId(p.name);
    case 'css':         return root.locator(p.expression);
    case 'xpath':       return root.locator(p.expression.startsWith('xpath=') ? p.expression : `xpath=${p.expression}`);
    default:            throw new Error(`unknown tier "${p.tier}"`);
  }
}

/** Render a proposal as the Playwright source expression (for paste-in + debt log). */
export function render(p) {
  const q = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
  const one = (x) => {
    switch (x.tier) {
      case 'role':        return `getByRole(${q(x.role)}${x.name ? `, { name: ${q(x.name)} }` : ''})`;
      case 'label':       return `getByLabel(${q(x.name)})`;
      case 'placeholder': return `getByPlaceholder(${q(x.name)})`;
      case 'text':        return `getByText(${q(x.name)})`;
      case 'altText':     return `getByAltText(${q(x.name)})`;
      case 'title':       return `getByTitle(${q(x.name)})`;
      case 'testid':      return `getByTestId(${q(x.name)})`;
      case 'css':         return `locator(${q(x.expression)})`;
      case 'xpath':       return `locator(${q(x.expression.startsWith('xpath=') ? x.expression : 'xpath=' + x.expression)})`;
      default:            return `/* ${x.tier} */`;
    }
  };
  // Frame base mirrors how gradeLocator resolved the root: a legacy <frame> (degraded)
  // renders as the Frame API; everything else (and the un-graded standalone call) as a frameLocator.
  const esc = (s) => String(s).replace(/'/g, "\\'");
  const fr = p.frameResolution;
  const base = !p.frame
    ? 'page'
    : fr?.mode === 'frame'
      ? `page.frame({ name: '${esc(fr.name)}' })`
      : `page.frameLocator('${esc(p.frame)}')`;
  return p.scope ? `${base}.${one(p.scope)}.${one({ ...p, scope: undefined })}` : `${base}.${one(p)}`;
}

function inferRole({ tag, type }) {
  if (tag === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'input') {
    if (['button', 'submit', 'reset'].includes(type)) return 'button';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (['', 'text', 'email', 'search', 'tel', 'url', 'password'].includes(type)) return 'textbox';
    return null;
  }
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  return null; // div/span/etc. → generic, intentionally NOT proposed as a handle
}

async function scrapeProps(handle) {
  return await handle.evaluate((el) => {
    let labelText = '';
    try { if (el.labels && el.labels[0]) labelText = el.labels[0].textContent.trim(); } catch { /* not labelable */ }
    return {
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute('type') || '').toLowerCase(),
      ariaLabel: el.getAttribute('aria-label') || '',
      labelText,
      placeholder: el.getAttribute('placeholder') || '',
      text: (el.textContent || '').trim(),
      alt: el.getAttribute('alt') || '',
      title: el.getAttribute('title') || '',
      testid: el.getAttribute('data-testid') || '',
    };
  });
}

function identity(p) {
  return { role: inferRole(p), name: p.ariaLabel || p.labelText || p.text || p.placeholder };
}

function flatCandidates(root, p) {
  const { role, name } = identity(p);
  const c = [];
  if (role && name) c.push({ tier: 'role', locator: root.getByRole(role, { name, exact: false }) });
  else if (role)    c.push({ tier: 'role', locator: root.getByRole(role) });
  if (p.labelText)   c.push({ tier: 'label',       locator: root.getByLabel(p.labelText, { exact: false }) });
  if (p.placeholder) c.push({ tier: 'placeholder', locator: root.getByPlaceholder(p.placeholder, { exact: false }) });
  if (p.text)        c.push({ tier: 'text',        locator: root.getByText(p.text, { exact: false }) });
  if (p.alt)         c.push({ tier: 'altText',     locator: root.getByAltText(p.alt, { exact: false }) });
  if (p.title)       c.push({ tier: 'title',       locator: root.getByTitle(p.title, { exact: false }) });
  if (p.testid)      c.push({ tier: 'testid',      locator: root.getByTestId(p.testid) });
  return c;
}

/** Best-effort accessible-scope candidate for the common table-row case. Fails open (null). */
async function scopedCandidate(root, handle, childRole, childName) {
  if (!childRole || !childName) return null;
  const rowText = await handle.evaluate((el) => {
    const row = el.closest('tr,[role=row]');
    if (!row) return null;
    for (const cell of row.querySelectorAll('td,th,[role=cell],[role=gridcell],[role=columnheader]')) {
      const t = (cell.textContent || '').trim();
      if (t) return t; // first non-empty cell — typically the unique row key
    }
    return null;
  });
  if (!rowText) return null;
  const locator = root.getByRole('row', { name: rowText }).getByRole(childRole, { name: childName });
  return { tier: 'scoped', locator, descriptor: `getByRole('row',{name:'${rowText}'}).getByRole('${childRole}',{name:'${childName}'})` };
}

async function resolvesSame(locator, targetHandle) {
  if ((await locator.count()) !== 1) return false;
  return await locator.evaluate((el, target) => el === target, targetHandle);
}

/**
 * Resolve the search ROOT for an in-frame proposal, with graceful degradation that
 * mirrors the locator ladder (prefer the accessible/modern handle; degrade and LOG).
 * Preferred: `page.frameLocator(sel)` — the modern API, but `<iframe>` only.
 * If that cannot reach the frame (a legacy `<frameset>/<frame>`, which frameLocator
 * does not support), DEGRADE to the lower-level Frame API resolved BY NAME
 * (`page.frame({ name })` pierces the whole frame tree, unlike a page CSS selector) —
 * recorded as debt, exactly like CSS at the bottom of the ladder. A Page, a FrameLocator
 * and a Frame all expose the same locator builders, so the grading body is identical
 * regardless of which root we return.
 */
async function resolveFrameRoot(page, frame) {
  const fl = page.frameLocator(frame);
  const reachable = await fl.locator(':root').count().catch(() => 0);
  if (reachable) return { root: fl, resolution: { mode: 'frameLocator', selector: frame } };
  // frameLocator reached nothing — try the deeper Frame API. Match a name out of a
  // `frame[name="x"]` hint, else treat the hint itself as the name.
  const m = /name\s*=\s*["']?([^"'\]]+)/.exec(frame);
  const name = m ? m[1] : frame;
  const fr = page.frame({ name });
  if (fr) return { root: fr, resolution: { mode: 'frame', name, degraded: true } };
  // Truly absent: fall back to the frameLocator root so grading reports "0 elements" as before.
  return { root: fl, resolution: { mode: 'frameLocator', selector: frame } };
}

/**
 * Grade a proposed locator against the priority ladder, on the live page.
 * Returns { ok, tier, degraded, suggestedTier?, suggestion?, reason?, debt? }.
 */
export async function gradeLocator(page, proposal) {
  const effectiveTier = proposal.scope ? 'scoped' : proposal.tier;
  const idx = TIERS.indexOf(effectiveTier);
  if (idx === -1) return { ok: false, reason: `unknown tier "${proposal.tier}"` };

  // Search context: page, or — for elements inside a frame — the frame root. Playwright
  // pierces OPEN shadow DOM automatically, but never frames, so durable locators for
  // in-frame elements must be scoped to a frame root. `resolveFrameRoot` prefers a
  // frameLocator (<iframe>) and degrades to the Frame API for legacy framesets; the
  // chosen resolution is stamped on the proposal so render() emits the matching base.
  // (Closed shadow roots are unreachable to both Playwright and the snapshot — such
  // elements resolve to 0 here.)
  let root = page;
  let frameResolution = null;
  if (proposal.frame) {
    ({ root, resolution: frameResolution } = await resolveFrameRoot(page, proposal.frame));
    proposal.frameResolution = frameResolution;
  }
  const frameDegraded = !!frameResolution?.degraded;

  const loc = buildLocator(root, proposal);
  const count = await loc.count();
  if (count !== 1) return { ok: false, reason: `resolves to ${count} elements, need exactly 1` };

  const handle = await loc.elementHandle();
  const props = await scrapeProps(handle);

  // 1. A unique FLAT accessible locator (role..testid) beats everything below it.
  for (const c of flatCandidates(root, props).filter((c) => TIERS.indexOf(c.tier) < idx)) {
    if (await resolvesSame(c.locator, handle)) {
      return { ok: false, suggestedTier: c.tier, reason: `a higher-priority locator (${c.tier}) uniquely resolves this element — use it instead of ${effectiveTier}` };
    }
  }

  // 2. For a raw CSS/XPath drop, a SCOPED accessible locator (if one exists) beats it.
  if (DEGRADED.has(effectiveTier)) {
    const { role, name } = identity(props);
    const scoped = await scopedCandidate(root, handle, role, name);
    if (scoped && (await resolvesSame(scoped.locator, handle))) {
      return { ok: false, suggestedTier: 'scoped', suggestion: scoped.descriptor, reason: `an accessible scoped locator resolves this element — use ${scoped.descriptor} instead of raw ${effectiveTier}` };
    }
  }

  const degraded = DEGRADED.has(proposal.tier) || (proposal.scope && DEGRADED.has(proposal.scope.tier));
  if (degraded && !proposal.reason) {
    return { ok: false, reason: `${proposal.tier} is a last-resort fallback; provide a "reason" documenting why no accessible handle exists (it is logged as accessibility debt)` };
  }
  // A legacy <frame> is structural, not a locator-quality choice the author made, so it is
  // auto-logged as debt (no model-provided reason required) — unlike a CSS/XPath drop above.
  const frameDebt = frameDegraded
    ? `legacy <frame> "${frameResolution.name}" reached via the Frame API — frameLocator does not support <frame>`
    : null;
  return {
    ok: true,
    tier: effectiveTier,
    degraded: !!degraded || frameDegraded,
    frameDegraded,
    frameResolution,
    debt: (degraded || frameDegraded)
      ? { tier: proposal.tier, expression: proposal.expression, reason: proposal.reason, ...(frameDebt ? { frame: frameDebt } : {}) }
      : null,
  };
}
