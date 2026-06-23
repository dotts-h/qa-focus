// Model selection (src/models.mts) — the pure resolve/format half of #0017 (epic 0015). The headless
// `--model` flag must FAIL LOUD on an unknown id (never silently fall back to a wrong model on a
// live, quota-burning run), and `--list-models` / `qa-focus models` prints the available set.
// Deterministic: synthetic ModelInfo records in, resolution/lines out — no client, no model.
import { test, expect } from '@playwright/test';
import { resolveModel, formatModelList } from '../src/models.mjs';

// Minimal synthetic ModelInfo — only the fields model selection reads (the SDK shape is larger).
const m = (id: string, name: string): any => ({ id, name });
const MODELS = [m('claude-sonnet-4.6', 'Claude Sonnet 4.6'), m('gpt-5', 'GPT-5'), m('claude-opus-4.8', 'Claude Opus 4.8')];

test('resolveModel returns the id when it exactly matches an available model', () => {
  expect(resolveModel(MODELS, 'gpt-5')).toEqual({ ok: true, model: 'gpt-5' });
});

test('resolveModel with no request uses the session default (no model pinned)', () => {
  expect(resolveModel(MODELS, undefined)).toEqual({ ok: true, model: undefined });
  expect(resolveModel(MODELS, '')).toEqual({ ok: true, model: undefined }); // empty == unset
});

test('resolveModel FAILS LOUD on an unknown id, listing the available ids', () => {
  const r = resolveModel(MODELS, 'gpt-4');
  expect(r.ok).toBe(false);
  expect((r as any).error).toContain('gpt-4');
  // the valid set is named so the operator can correct it (no silent fallback)
  for (const id of ['claude-sonnet-4.6', 'gpt-5', 'claude-opus-4.8']) expect((r as any).error).toContain(id);
});

test('resolveModel is case- and whitespace-exact (a near-miss is an error, not a guess)', () => {
  expect(resolveModel(MODELS, 'GPT-5').ok).toBe(false); // wrong case → error, not a coerced match
  expect(resolveModel(MODELS, ' gpt-5 ').ok).toBe(true); // surrounding whitespace is trimmed
});

test('resolveModel on an empty model list errors for any requested id', () => {
  expect(resolveModel([], 'gpt-5').ok).toBe(false);
  expect(resolveModel([], undefined)).toEqual({ ok: true, model: undefined }); // unset still fine
});

test('formatModelList renders one line per model with id and name', () => {
  const out = formatModelList(MODELS);
  expect(out).toContain('claude-sonnet-4.6');
  expect(out).toContain('Claude Sonnet 4.6');
  expect(out.trim().split('\n').filter((l) => l.includes('claude-sonnet-4.6'))).toHaveLength(1);
  // the id (the thing you pass to --model) is present verbatim for every model
  for (const mi of MODELS) expect(out).toContain(mi.id);
});

test('formatModelList says so when there are no models', () => {
  expect(formatModelList([])).toMatch(/no models/i);
});
