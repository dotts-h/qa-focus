// Structured flow capture — the EXPLORER→CODIFIER bridge (M4, the keystone of the thesis).
//
// The explorer DISCOVERS flows; the codifier HARDENS them into gated specs. Until now a
// human bridged the two by hand (re-writing a GOAL). This module is the machine-readable
// seam: the explorer records each semantic step in DURABLE terms — an action plus the
// target's accessible role+name — NOT the ephemeral `[ref=e5]` snapshot ids (which are
// regenerated every snapshot and meaningless once the page reloads). The codifier then
// reads that flow and re-walks the SAME steps, grading every locator live through the gate.
//
// Control-first invariant: the flow is a SEED a human (and the gate) verifies, never trusted
// output — consistent with "findings are never self-certified" (CONTRACTS.md). The codifier
// re-derives and gate-grades every locator; the flow only says WHAT to harden, not that it is
// already correct.
import type { UsageSummary } from './cost.mjs';

/** One durable, accessible step in a captured flow (NOT a snapshot ref). */
export interface FlowStep {
  action: 'goto' | 'click' | 'fill' | 'press' | 'expect' | string;
  url?: string;
  role?: string;
  name?: string;
  text?: string;
  key?: string;
  frame?: string | string[]; // a single <iframe> selector, or an outer→inner chain for nested frames
  submit?: boolean;
  /** the action was REFUSED by the leash (e.g. an off-allowlist goto). Recorded as evidence — a
   * blocked attempt the red-team (#0009) can assert on — but excluded from the codifier seed. */
  denied?: boolean;
}

/** A captured flow — the explorer→codifier handoff artifact (artifacts/explore-flow.json). */
export interface Flow {
  goal: string;
  startUrl: string;
  surface: string;
  steps: FlowStep[];
  /** the run's token + AI-Credits usage (#0014), folded in when the flow is written. */
  usage?: UsageSummary;
}

/** A fresh, empty flow record. */
export function newFlow({ goal = '', startUrl = '', surface = 'web' }: Partial<Omit<Flow, 'steps'>> = {}): Flow {
  return { goal, startUrl, surface, steps: [] };
}

/**
 * Parse a @playwright/cli snapshot into `ref → { role, name }`.
 * Snapshot lines look like (indentation + extra attrs vary):
 *   - button "Add" [ref=e6]
 *   - textbox "New task" [ref=e5]
 *   - heading "Todo" [level=1] [ref=e2]
 *   - generic [active] [ref=e1]        (no accessible name)
 *   - paragraph "Hi" [ref=f2e2]        (frame-prefixed ref)
 * role = the first token after the list dash; name = the first quoted string (when present).
 * Lines without a [ref=…] (non-interactive nodes like `list "tasks"`) are skipped.
 */
export function parseSnapshotRefs(text: string): Map<string, { role: string; name: string }> {
  const map = new Map<string, { role: string; name: string }>();
  for (const line of String(text).split('\n')) {
    const ref = line.match(/\[ref=([A-Za-z0-9]+)\]/);
    if (!ref) continue;
    const role = line.match(/^\s*-\s+([A-Za-z]+)/);
    const name = line.match(/"([^"]*)"/);
    map.set(ref[1], { role: role ? role[1] : '', name: name ? name[1] : '' });
  }
  return map;
}

/** Append a semantic step. No-op when `flow` is undefined, so the shared tools stay usable
 *  in contexts that don't record (codifier, extension). */
export function recordStep(flow: Flow | undefined, step: FlowStep): void {
  if (flow && Array.isArray(flow.steps)) flow.steps.push(step);
}

function describeStep(s: FlowStep): string {
  switch (s.action) {
    case 'goto':   return `goto ${s.url}`;
    case 'click':  return `click the ${s.role || 'element'}${s.name ? ` "${s.name}"` : ''}`;
    case 'fill':   return `fill the ${s.role || 'field'}${s.name ? ` "${s.name}"` : ''} with "${s.text ?? ''}"${s.submit ? ' and press Enter' : ''}`;
    case 'press':  return `press ${s.key}`;
    case 'expect': return `assert visible: ${s.role ? `${s.role}${s.name ? ` "${s.name}"` : ''}` : `text "${s.text ?? ''}"`}${s.frame ? ` (inside frame ${s.frame})` : ''}`;
    default:       return JSON.stringify(s);
  }
}

/**
 * Render a captured flow as a concrete SEED prompt for the codifier: the discovered recipe to
 * re-walk and harden. It is explicitly framed as a hint to VERIFY live (via propose_locator),
 * not a spec to trust — preserving the control-first / never-self-certified invariant.
 */
export function flowToSeed(flow: Flow): string {
  return [
    `A prior exploration discovered this flow${flow.goal ? ` (goal: ${flow.goal})` : ''}.`,
    flow.startUrl ? `Start URL: ${flow.startUrl}.` : '',
    'Re-walk and HARDEN exactly these steps. Treat the targets below as descriptors to verify',
    'on the live page via propose_locator (do NOT trust them blindly — the gate is authoritative):',
    // Denied steps (e.g. a blocked off-allowlist goto) are evidence, not flow — never seed them.
    ...flow.steps.filter((s) => !s.denied).map((s, i) => `${i + 1}. ${describeStep(s)}`),
  ].filter(Boolean).join('\n');
}

/** Shape guard for a value loaded from disk (FLOW=…). */
export function isFlow(o: unknown): o is Flow {
  return !!o && typeof o === 'object' && Array.isArray((o as Flow).steps);
}
