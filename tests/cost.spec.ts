// Per-run cost & usage accounting (src/cost.mts) — the pure accumulate+render half of #0014
// (epic 0012). Rides the same `assistant.usage` event tap as the live stream (#0013). Deterministic:
// synthetic AssistantUsageEvent.data records + a fixed credits→$ rate in, summary/lines out — no
// model, no quota.
import { test, expect } from '@playwright/test';
import { accumulateUsage, formatUsage, renderCostSummary } from '../src/cost.mjs';

// Minimal synthetic usage records — only the fields cost.mts reads (the SDK AssistantUsageData is huge).
const u = (model: string, input: number, output: number, extra: Record<string, unknown> = {}): any => ({ model, inputTokens: input, outputTokens: output, ...extra });
const nano = (totalNanoAiu: number) => ({ copilotUsage: { totalNanoAiu } });

test('accumulateUsage sums tokens and counts requests across one model', () => {
  const s = accumulateUsage([u('sonnet', 100, 50), u('sonnet', 200, 80)]);
  expect(s.requests).toBe(2);
  expect(s.totals).toEqual({ input: 300, output: 130, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 430 });
  expect(s.models).toHaveLength(1);
  expect(s.models[0]).toMatchObject({ model: 'sonnet', input: 300, output: 130, total: 430, requests: 2 });
  expect(s.aiCredits).toBeUndefined(); // no copilotUsage on any record → no credits figure
});

test('accumulateUsage groups per model and sorts by total tokens descending', () => {
  const s = accumulateUsage([u('small', 10, 5), u('big', 1000, 500), u('small', 20, 10)]);
  expect(s.models.map((m) => m.model)).toEqual(['big', 'small']);
  expect(s.models[1]).toMatchObject({ model: 'small', input: 30, output: 15, requests: 2 });
});

test('cache and reasoning tokens are tracked separately and not double-counted into total', () => {
  const s = accumulateUsage([u('m', 100, 40, { cacheReadTokens: 70, cacheWriteTokens: 30, reasoningTokens: 25 })]);
  expect(s.totals.cacheRead).toBe(70);
  expect(s.totals.cacheWrite).toBe(30);
  expect(s.totals.reasoning).toBe(25);
  expect(s.totals.total).toBe(140); // input + output only
});

test('AI-Credits are summed from copilotUsage.totalNanoAiu (1 AIU = 1e9 nano)', () => {
  const s = accumulateUsage([u('m', 100, 50, nano(420_000_000)), u('m', 100, 50, nano(180_000_000))]);
  expect(s.aiCredits).toBeCloseTo(0.6, 9); // (420M + 180M) / 1e9
  expect(s.models[0].aiCredits).toBeCloseTo(0.6, 9);
});

test('a USD estimate is added only when a credits→$ rate is supplied AND credits are known', () => {
  const withCredits = accumulateUsage([u('m', 100, 50, nano(500_000_000))], { creditsToUsd: 0.1 });
  expect(withCredits.aiCredits).toBeCloseTo(0.5, 9);
  expect(withCredits.usd).toBeCloseTo(0.05, 9);
  // rate supplied but the model never reported credits → no usd (don't fabricate a cost)
  const noCredits = accumulateUsage([u('m', 100, 50)], { creditsToUsd: 0.1 });
  expect(noCredits.usd).toBeUndefined();
});

test('an absent inputTokens/outputTokens field counts as zero, not NaN', () => {
  const s = accumulateUsage([{ model: 'm' } as any]);
  expect(s.totals.total).toBe(0);
  expect(s.models[0]).toMatchObject({ model: 'm', input: 0, output: 0, requests: 1 });
});

test('a record with no model falls back to "unknown"', () => {
  const s = accumulateUsage([{ inputTokens: 5, outputTokens: 5 } as any]);
  expect(s.models[0].model).toBe('unknown');
});

test('formatUsage renders grouped token totals, per-model lines, and the credits line', () => {
  const s = accumulateUsage([u('claude-sonnet', 12000, 3400, nano(420_000_000))], { creditsToUsd: 0.1 });
  const lines = formatUsage(s);
  expect(lines[0]).toContain('12,000 in + 3,400 out');
  expect(lines[0]).toContain('1 request');
  expect(lines.some((l) => l.includes('claude-sonnet') && l.includes('0.42 AIU'))).toBe(true);
  expect(lines.some((l) => l.includes('0.42 AI-Credits') && l.includes('$0.04'))).toBe(true);
});

test('formatUsage states credits are unavailable when the model exposed none', () => {
  const lines = formatUsage(accumulateUsage([u('m', 10, 5)]));
  expect(lines.some((l) => /AI-Credits not reported/i.test(l))).toBe(true);
});

test('formatUsage on an empty run says so instead of printing zeros', () => {
  expect(formatUsage(accumulateUsage([]))).toEqual(['no model usage recorded']);
});

test('renderCostSummary prefixes a header above the usage lines', () => {
  const out = renderCostSummary(accumulateUsage([u('m', 100, 50)]));
  expect(out.split('\n')[0]).toBe('Usage & cost:');
  expect(out).toContain('100 in + 50 out');
});
