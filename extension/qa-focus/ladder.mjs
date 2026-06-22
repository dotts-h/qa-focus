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
  return p.scope ? `page.${one(p.scope)}.${one({ ...p, scope: undefined })}` : `page.${one(p)}`;
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

function flatCandidates(page, p) {
  const { role, name } = identity(p);
  const c = [];
  if (role && name) c.push({ tier: 'role', locator: page.getByRole(role, { name, exact: false }) });
  else if (role)    c.push({ tier: 'role', locator: page.getByRole(role) });
  if (p.labelText)   c.push({ tier: 'label',       locator: page.getByLabel(p.labelText, { exact: false }) });
  if (p.placeholder) c.push({ tier: 'placeholder', locator: page.getByPlaceholder(p.placeholder, { exact: false }) });
  if (p.text)        c.push({ tier: 'text',        locator: page.getByText(p.text, { exact: false }) });
  if (p.alt)         c.push({ tier: 'altText',     locator: page.getByAltText(p.alt, { exact: false }) });
  if (p.title)       c.push({ tier: 'title',       locator: page.getByTitle(p.title, { exact: false }) });
  if (p.testid)      c.push({ tier: 'testid',      locator: page.getByTestId(p.testid) });
  return c;
}

/** Best-effort accessible-scope candidate for the common table-row case. Fails open (null). */
async function scopedCandidate(page, handle, childRole, childName) {
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
  const locator = page.getByRole('row', { name: rowText }).getByRole(childRole, { name: childName });
  return { tier: 'scoped', locator, descriptor: `getByRole('row',{name:'${rowText}'}).getByRole('${childRole}',{name:'${childName}'})` };
}

async function resolvesSame(locator, targetHandle) {
  if ((await locator.count()) !== 1) return false;
  return await locator.evaluate((el, target) => el === target, targetHandle);
}

/**
 * Grade a proposed locator against the priority ladder, on the live page.
 * Returns { ok, tier, degraded, suggestedTier?, suggestion?, reason?, debt? }.
 */
export async function gradeLocator(page, proposal) {
  const effectiveTier = proposal.scope ? 'scoped' : proposal.tier;
  const idx = TIERS.indexOf(effectiveTier);
  if (idx === -1) return { ok: false, reason: `unknown tier "${proposal.tier}"` };

  const loc = buildLocator(page, proposal);
  const count = await loc.count();
  if (count !== 1) return { ok: false, reason: `resolves to ${count} elements, need exactly 1` };

  const handle = await loc.elementHandle();
  const props = await scrapeProps(handle);

  // 1. A unique FLAT accessible locator (role..testid) beats everything below it.
  for (const c of flatCandidates(page, props).filter((c) => TIERS.indexOf(c.tier) < idx)) {
    if (await resolvesSame(c.locator, handle)) {
      return { ok: false, suggestedTier: c.tier, reason: `a higher-priority locator (${c.tier}) uniquely resolves this element — use it instead of ${effectiveTier}` };
    }
  }

  // 2. For a raw CSS/XPath drop, a SCOPED accessible locator (if one exists) beats it.
  if (DEGRADED.has(effectiveTier)) {
    const { role, name } = identity(props);
    const scoped = await scopedCandidate(page, handle, role, name);
    if (scoped && (await resolvesSame(scoped.locator, handle))) {
      return { ok: false, suggestedTier: 'scoped', suggestion: scoped.descriptor, reason: `an accessible scoped locator resolves this element — use ${scoped.descriptor} instead of raw ${effectiveTier}` };
    }
  }

  const degraded = DEGRADED.has(proposal.tier) || (proposal.scope && DEGRADED.has(proposal.scope.tier));
  if (degraded && !proposal.reason) {
    return { ok: false, reason: `${proposal.tier} is a last-resort fallback; provide a "reason" documenting why no accessible handle exists (it is logged as accessibility debt)` };
  }
  return {
    ok: true,
    tier: effectiveTier,
    degraded: !!degraded,
    debt: degraded ? { tier: proposal.tier, expression: proposal.expression, reason: proposal.reason } : null,
  };
}
