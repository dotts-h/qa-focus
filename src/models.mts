// Model selection (#0017, epic 0015) — list the Copilot models and resolve a requested one.
//
// The pure half (resolveModel / formatModelList) is unit-tested with synthetic ModelInfo. The leash
// principle applies here too: a `--model` the operator typed must FAIL LOUD if it isn't a real model
// (an unknown id on a live, quota-burning run must not silently fall back to the wrong model). The
// one impure helper (listCopilotModels) opens a short-lived client to the installed copilot CLI.
import { CopilotClient, RuntimeConnection } from '@github/copilot-sdk';
import type { ModelInfo } from '@github/copilot-sdk';

/** Resolve a requested model id against the available set. Pure. */
export type ResolveResult = { ok: true; model?: string } | { ok: false; error: string };

/**
 * Resolve `requested` against `models`:
 * - unset/empty → `{ ok: true, model: undefined }` (use the session default).
 * - exact id match (trimmed) → `{ ok: true, model: <id> }`.
 * - anything else → `{ ok: false, error }` naming the valid ids — never a silent fallback.
 */
export function resolveModel(models: ModelInfo[], requested?: string): ResolveResult {
  const want = (requested ?? '').trim();
  if (!want) return { ok: true, model: undefined };
  if (models.some((m) => m.id === want)) return { ok: true, model: want };
  const ids = models.map((m) => m.id);
  const avail = ids.length ? ids.join(', ') : '(none returned by the copilot login)';
  return { ok: false, error: `unknown model "${want}". Available: ${avail}` };
}

/** Render the available models as display lines (id is what you pass to --model). Pure. */
export function formatModelList(models: ModelInfo[]): string {
  if (!models.length) return 'no models available (is the copilot login set up?)';
  const width = Math.max(...models.map((m) => m.id.length));
  const lines = models.map((m) => `  ${m.id.padEnd(width)}  ${m.name || ''}`.trimEnd());
  return ['Available models (pass an id to --model; omit it to use the session default):', ...lines].join('\n');
}

/**
 * Open a short-lived client to the installed copilot CLI and list its models. Impure (spawns the
 * runtime); the pure resolve/format above is what carries the testable logic.
 */
export async function listCopilotModels(cli: string): Promise<ModelInfo[]> {
  const client = new CopilotClient({ connection: RuntimeConnection.forStdio({ path: cli }) });
  try {
    await client.start(); // listModels needs an explicit connect (createSession would auto-start, but we make no session)
    return await client.listModels();
  } finally {
    await client.stop?.();
  }
}
