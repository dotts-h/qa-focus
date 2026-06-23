// Self-healing locator recovery (M5) — the control-first answer to "no silent
// green-washing." When an authored locator stops resolving (role renamed, element
// re-tagged), a naive healer that rewrites the test to pass hides a real regression.
// Instead, healLocator proposes a REPLACEMENT only when the deterministic gate
// (ladder.mjs) cleanly accepts a UNIQUE candidate, returns it flagged
// needsConfirmation, and REFUSES (healed:false) when recovery is ambiguous — it never
// guesses into the wrong element, and the human/codifier confirms before adopting it.
import { gradeLocator, render } from '../extension/qa-focus/ladder.mjs';

// Common interactive roles to try when the accessible NAME looks stable but the role
// drifted (e.g. a <button> became an <a>). Bounded + each is gate-graded to exactly 1.
const COMMON_ROLES = ['button', 'link', 'heading', 'textbox', 'checkbox', 'tab', 'menuitem', 'combobox'];

/**
 * Attempt a gate-verified recovery for a broken proposal on the CURRENT page.
 * @returns {Promise<
 *   | { healed: false, reason: string, was?: string, current?: string }
 *   | { healed: true, needsConfirmation: true, was: string, proposal: object, locator: string, tier: string }
 * >}
 */
export async function healLocator(page, broken) {
  // Still resolves cleanly? Then the test failed for another reason — nothing to heal,
  // and silently "fixing" a working locator would be exactly the green-washing we forbid.
  const asis = await gradeLocator(page, { ...broken });
  if (asis.ok) return { healed: false, reason: 'locator still resolves — nothing to heal (the failure is elsewhere)', current: render(broken) };

  const candidates = [];
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
