// Self-healing locator recovery (M5) — the control-first answer to "no silent
// green-washing." When an authored locator stops resolving (role renamed, element
// re-tagged), a naive healer that rewrites the test to pass hides a real regression.
// Instead, healLocator proposes a REPLACEMENT only when the deterministic gate
// (ladder.mts) cleanly accepts a UNIQUE candidate, returns it flagged
// needsConfirmation, and REFUSES (healed:false) when recovery is ambiguous — it never
// guesses into the wrong element, and the human/codifier confirms before adopting it.
import type { Page } from 'playwright';
import { gradeLocator, buildLocator, render } from '../extension/qa-focus/ladder.mjs';
import type { Proposal } from '../extension/qa-focus/ladder.mjs';

// Common interactive roles to try when the accessible NAME looks stable but the role
// drifted (e.g. a <button> became an <a>). Bounded + each is gate-graded to exactly 1.
const COMMON_ROLES = ['button', 'link', 'heading', 'textbox', 'checkbox', 'tab', 'menuitem', 'combobox'];

/** The healer's verdict: a gate-verified replacement (needs confirmation) or a refusal. */
export type HealResult =
  | { healed: false; reason: string; was?: string; current?: string }
  | { healed: true; needsConfirmation: true; was: string; proposal: Proposal; locator: string; tier: string };

/**
 * Attempt a gate-verified recovery for a broken proposal on the CURRENT page.
 */
export async function healLocator(page: Page, broken: Proposal): Promise<HealResult> {
  // Still resolves cleanly? Then the test failed for another reason — nothing to heal,
  // and silently "fixing" a working locator would be exactly the green-washing we forbid.
  const asis = await gradeLocator(page, { ...broken });
  if (asis.ok) return { healed: false, reason: 'locator still resolves — nothing to heal (the failure is elsewhere)', current: render(broken) };

  const candidates: Proposal[] = [];
  // 1. Name looks stable, role drifted → try the same name under other common roles (most durable).
  if (broken.name) for (const role of COMMON_ROLES) if (role !== broken.role) candidates.push({ tier: 'role', role, name: broken.name });
  // 2. Name drifted but the element is the only one of its role → role-only (when unique).
  if (broken.role) candidates.push({ tier: 'role', role: broken.role });
  // 3. Last accessible fallbacks: the visible text, or a labelled field.
  if (broken.name) { candidates.push({ tier: 'text', name: broken.name }); candidates.push({ tier: 'label', name: broken.name }); }

  for (const c of candidates) {
    const g = await gradeLocator(page, { ...c }); // the gate is authoritative: exactly-1 + no higher tier beats it
    if (g.ok) return { healed: true, needsConfirmation: true, was: render(broken), proposal: c, locator: render(c), tier: g.tier };
  }
  return { healed: false, reason: 'no unambiguous accessible recovery — re-author the locator by hand (or use a trace-driven heal)', was: render(broken) };
}

// ---------------------------------------------------------------------------
// Trace-driven healing (#0010, M5). The page-based healLocator above sees only the LIVE page; when
// the page grew ambiguous (two identical accessible targets) it correctly refuses. The failure
// trace's DOM snapshot — captured when the locator still worked — carries the disambiguator: the
// intended element's accessible ANCESTOR scope. Recovering that scope turns a flat (non-unique)
// locator into a gate-verified SCOPED one (ladder tier 8), still flagged needs-confirmation, still
// refusing when even the scope is not unique (no silent green-washing).

/** Context recovered from a failure trace that the broken (flat) locator alone lacked. */
export interface TraceContext {
  /** the intended element's nearest accessible ancestor (a named row/region/group). */
  scope?: { role: string; name: string };
  /** a fuller/corrected accessible name for the target, if the broken one had drifted. */
  name?: string;
  /** whether the recovered name should match exactly. */
  exact?: boolean;
}

// Roles worth scoping to — accessible containers that carry a stable name (a table row, a landmark
// region, a list item). A scope under one of these is the durable "which one" the live page lost.
const SCOPE_ROLES = new Set([
  'row', 'rowgroup', 'region', 'group', 'listitem', 'article', 'form', 'navigation',
  'complementary', 'banner', 'contentinfo', 'main', 'table', 'grid', 'list', 'tabpanel', 'dialog',
]);

/**
 * Read a failure trace's DOM snapshot (loaded into `snapshotPage`) and recover the intended
 * element's accessible ancestor scope. In the snapshot the locator was still unambiguous, so we can
 * pin the element and walk up to the nearest named container — the disambiguator to apply on the
 * live page. Returns `{}` when the snapshot can't pin the element or it has no named scope.
 */
export async function extractTraceContext(snapshotPage: Page, broken: Proposal): Promise<TraceContext> {
  const target = buildLocator(snapshotPage, { ...broken });
  if ((await target.count()) !== 1) return {}; // not unambiguous even in the snapshot → no signal
  const handle = await target.elementHandle();
  if (!handle) return {};
  try {
    const scope = await handle.evaluate((el, scopeRoles: string[]) => {
      const roleOf = (e: Element): string | null => {
        const explicit = e.getAttribute('role');
        if (explicit) return explicit;
        const map: Record<string, string> = {
          nav: 'navigation', main: 'main', form: 'form', header: 'banner', footer: 'contentinfo',
          aside: 'complementary', ul: 'list', ol: 'list', li: 'listitem', table: 'table',
          tr: 'row', article: 'article', section: 'region', dialog: 'dialog',
        };
        return map[e.tagName.toLowerCase()] ?? null;
      };
      const nameOf = (e: Element): string => (e.getAttribute('aria-label') || '').trim();
      let cur = el.parentElement;
      while (cur) {
        const role = roleOf(cur);
        const name = nameOf(cur);
        if (role && scopeRoles.includes(role) && name) return { role, name };
        cur = cur.parentElement;
      }
      return null;
    }, [...SCOPE_ROLES]);
    return scope ? { scope } : {};
  } finally {
    await handle.dispose();
  }
}

/**
 * Attempt a gate-verified recovery for a broken proposal on the CURRENT page using context recovered
 * from the failure trace. Tries the trace's scope (and any corrected name) as gate-graded candidates;
 * returns the first that resolves to exactly one element (flagged needsConfirmation), and REFUSES
 * when none does — never guessing into the wrong element.
 */
export async function healFromTrace(page: Page, broken: Proposal, trace: TraceContext): Promise<HealResult> {
  // A still-resolving locator means the failure is elsewhere — "fixing" it would be green-washing.
  const asis = await gradeLocator(page, { ...broken });
  if (asis.ok) return { healed: false, reason: 'locator still resolves — nothing to heal (the failure is elsewhere)', current: render(broken) };

  const scope: Proposal | undefined = trace.scope ? { tier: 'role', role: trace.scope.role, name: trace.scope.name } : undefined;
  const correctedName = trace.name && trace.name !== broken.name ? trace.name : undefined;

  const candidates: Proposal[] = [];
  // 1. Strongest: the SAME target, scoped to its trace-recovered container (the durable disambiguator).
  if (scope) candidates.push({ tier: broken.tier, role: broken.role, name: broken.name, scope });
  // 2. A fuller/corrected exact name the broken locator had lost.
  if (correctedName) candidates.push({ tier: 'role', role: broken.role, name: correctedName, exact: trace.exact });
  // 3. Both: scoped AND corrected name.
  if (scope && correctedName) candidates.push({ tier: broken.tier, role: broken.role, name: correctedName, exact: trace.exact, scope });

  for (const c of candidates) {
    const g = await gradeLocator(page, { ...c }); // the gate stays authoritative: exactly-1, no higher tier beats it
    if (g.ok) return { healed: true, needsConfirmation: true, was: render(broken), proposal: c, locator: render(c), tier: g.tier };
  }
  return { healed: false, reason: 'the trace context did not yield an unambiguous recovery — re-author by hand', was: render(broken) };
}
