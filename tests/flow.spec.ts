// The structured-flow bridge (src/flow.mjs) — the explorer→codifier handoff (M4).
// Deterministic: no browser, no model. Proves the explorer can record a durable,
// machine-readable flow (semantic steps, not ephemeral snapshot refs) and that the
// codifier-seed it produces re-states those steps as a recipe to harden.
import { test, expect } from '@playwright/test';
import { parseSnapshotRefs, newFlow, recordStep, flowToSeed, isFlow } from '../src/flow.mjs';

// A real @playwright/cli snapshot (captured from the fixture app).
const SNAPSHOT = `### Page
- Page URL: http://localhost:3091/
### Snapshot
\`\`\`yaml
- generic [active] [ref=e1]:
  - heading "Todo" [level=1] [ref=e2]
  - generic [ref=e3]:
    - generic [ref=e4]:
      - text: New task
      - textbox "New task" [ref=e5]
    - button "Add" [ref=e6]
  - list "tasks"
\`\`\``;

test('parseSnapshotRefs maps refs to accessible role + name', () => {
  const m = parseSnapshotRefs(SNAPSHOT);
  expect(m.get('e5')).toEqual({ role: 'textbox', name: 'New task' });
  expect(m.get('e6')).toEqual({ role: 'button', name: 'Add' });
  expect(m.get('e2')).toEqual({ role: 'heading', name: 'Todo' });
  // a generic with no accessible name still resolves a role, empty name
  expect(m.get('e1')).toEqual({ role: 'generic', name: '' });
  // "list \"tasks\"" has no ref (non-interactive) — not in the map
  expect([...m.keys()]).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6']);
});

test('parseSnapshotRefs handles frame-prefixed refs', () => {
  const m = parseSnapshotRefs('- paragraph "Hello" [ref=f2e2]');
  expect(m.get('f2e2')).toEqual({ role: 'paragraph', name: 'Hello' });
});

test('a recorded flow round-trips into an ordered codifier seed', () => {
  const flow = newFlow({ goal: 'Add a task', startUrl: 'http://localhost:3000', surface: 'web' });
  const refs = parseSnapshotRefs(SNAPSHOT);
  recordStep(flow, { action: 'goto', url: 'http://localhost:3000' });
  recordStep(flow, { action: 'fill', ...refs.get('e5'), text: 'buy milk' });
  recordStep(flow, { action: 'click', ...refs.get('e6') });
  recordStep(flow, { action: 'expect', text: 'buy milk' });

  expect(isFlow(flow)).toBe(true);
  expect(flow.steps).toHaveLength(4);

  const seed = flowToSeed(flow);
  expect(seed).toContain('goal: Add a task');
  expect(seed).toContain('Start URL: http://localhost:3000');
  // steps appear, in order, in durable accessible terms (no ephemeral refs leak through)
  expect(seed).not.toMatch(/\be5\b|\be6\b/);
  const gotoAt = seed.indexOf('goto http://localhost:3000');
  const fillAt = seed.indexOf('fill the textbox "New task" with "buy milk"');
  const clickAt = seed.indexOf('click the button "Add"');
  const expectAt = seed.indexOf('assert visible: text "buy milk"');
  expect(gotoAt).toBeGreaterThanOrEqual(0);
  expect(fillAt).toBeGreaterThan(gotoAt);
  expect(clickAt).toBeGreaterThan(fillAt);
  expect(expectAt).toBeGreaterThan(clickAt);
});

test('recordStep on an undefined flow is a no-op (tools stay shareable)', () => {
  expect(() => recordStep(undefined, { action: 'goto', url: 'x' })).not.toThrow();
});

test('isFlow rejects non-flows', () => {
  expect(isFlow(null)).toBe(false);
  expect(isFlow({})).toBe(false);
  expect(isFlow({ steps: [] })).toBe(true);
});
