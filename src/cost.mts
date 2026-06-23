// Per-run cost & usage accounting (#0014, epic 0012) — report what a run COST, surfaced even on
// direct `explore`/`codify`/`interactive` shell runs. Rides the same `assistant.usage` event tap as
// the live stream (#0013): the harness (ADR 0002) subscribes once and accumulates the raw usage
// records; this module is the PURE half that sums + prices them, unit-tested with synthetic events.
//
// Honesty note: the Copilot runtime denominates cost in **AI Credits**, not USD. The per-request
// figure `copilotUsage.totalNanoAiu` (nano-AIU; 1 AIU = 1e9 nano) is the authoritative cost — we sum
// it directly rather than re-pricing tokens. A `$` figure is only ever an estimate from a user-set
// credits→$ rate (env `QA_AIU_USD`); without that rate we report tokens + AI-Credits and no dollars.
import type { CopilotSession } from '@github/copilot-sdk';

const NANO_PER_AIU = 1e9;

/** Structural subset of the SDK's `AssistantUsageEvent.data` that cost accounting reads. */
export interface UsageRecord {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  /** Authoritative AI-Credits cost for this request, in nano-AIU. */
  copilotUsage?: { totalNanoAiu?: number };
}

/** Token tallies (cache/reasoning tracked but NOT folded into `total = input + output`). */
export interface TokenTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  total: number;
}

/** Per-model rollup. `aiCredits` (AIU) present only when the model reported `copilotUsage`. */
export interface ModelUsage extends TokenTotals {
  model: string;
  requests: number;
  aiCredits?: number;
}

/** The accumulated summary for a whole run. */
export interface UsageSummary {
  requests: number;
  totals: TokenTotals;
  models: ModelUsage[];
  /** total AI-Credits (AIU) — undefined when no record carried `copilotUsage`. */
  aiCredits?: number;
  /** optional USD estimate — only when a credits→$ rate is supplied AND credits are known. */
  usd?: number;
}

export interface AccumulateOptions {
  /** USD per 1 AI-Credit (env `QA_AIU_USD`). Adds an estimated `$` figure when credits are known. */
  creditsToUsd?: number;
}

const emptyTotals = (): TokenTotals => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 });

/**
 * Sum a run's usage records into a per-model + grand-total summary, pricing AI-Credits from the
 * authoritative `copilotUsage.totalNanoAiu` field. Pure — no I/O, no SDK calls.
 */
export function accumulateUsage(records: UsageRecord[], opts: AccumulateOptions = {}): UsageSummary {
  const byModel = new Map<string, ModelUsage>();
  const totals = emptyTotals();
  let nanoAiu = 0;
  let sawCredits = false;

  for (const r of records) {
    const model = r.model || 'unknown';
    let mu = byModel.get(model);
    if (!mu) { mu = { model, ...emptyTotals(), requests: 0 }; byModel.set(model, mu); }

    const input = r.inputTokens ?? 0;
    const output = r.outputTokens ?? 0;
    const cacheRead = r.cacheReadTokens ?? 0;
    const cacheWrite = r.cacheWriteTokens ?? 0;
    const reasoning = r.reasoningTokens ?? 0;

    for (const acc of [mu, totals]) {
      acc.input += input; acc.output += output; acc.cacheRead += cacheRead;
      acc.cacheWrite += cacheWrite; acc.reasoning += reasoning; acc.total += input + output;
    }
    mu.requests++;

    const nano = r.copilotUsage?.totalNanoAiu;
    // `Number.isFinite` (not just `typeof === 'number'`) so a malformed NaN/Infinity from one bad
    // request is skipped rather than poisoning the whole run's credit total. A real 0 still counts.
    if (typeof nano === 'number' && Number.isFinite(nano)) {
      nanoAiu += nano;
      sawCredits = true;
      mu.aiCredits = (mu.aiCredits ?? 0) + nano / NANO_PER_AIU;
    }
  }

  const summary: UsageSummary = {
    requests: records.length,
    totals,
    models: [...byModel.values()].sort((a, b) => b.total - a.total),
  };
  if (sawCredits) {
    summary.aiCredits = nanoAiu / NANO_PER_AIU;
    if (opts.creditsToUsd != null) summary.usd = summary.aiCredits * opts.creditsToUsd;
  }
  return summary;
}

const grp = (n: number): string => n.toLocaleString('en-US'); // deterministic thousands grouping
const aiu = (n: number): string => n.toFixed(4).replace(/\.?0+$/, ''); // trim trailing zeros: 0.4200 → 0.42

/** Render a summary as display lines (no header) — shared by stdout and the evidence artifact. */
export function formatUsage(s: UsageSummary): string[] {
  if (!s.requests) return ['no model usage recorded'];
  const t = s.totals;
  const lines: string[] = [];
  lines.push(
    `${grp(t.input)} in + ${grp(t.output)} out tokens` +
      (t.cacheRead ? `, ${grp(t.cacheRead)} cache-read` : '') +
      (t.reasoning ? `, ${grp(t.reasoning)} reasoning` : '') +
      ` across ${s.requests} request${s.requests === 1 ? '' : 's'}`,
  );
  for (const m of s.models) {
    lines.push(
      `  • ${m.model}: ${grp(m.input)} in + ${grp(m.output)} out (${m.requests} req)` +
        (m.aiCredits != null ? `, ${aiu(m.aiCredits)} AIU` : ''),
    );
  }
  if (s.aiCredits != null) {
    lines.push(`Cost: ${aiu(s.aiCredits)} AI-Credits` + (s.usd != null ? ` (~$${s.usd.toFixed(4)})` : ''));
  } else {
    lines.push('Cost: AI-Credits not reported by the model (tokens only)');
  }
  return lines;
}

/** Render the full stdout cost block (header + lines). */
export function renderCostSummary(s: UsageSummary): string {
  return ['Usage & cost:', ...formatUsage(s)].join('\n');
}

/** A live usage meter wired to a session's `assistant.usage` stream. */
export interface CostMeter {
  /** the run's usage so far (priced with the optional credits→$ rate). */
  getUsage: (opts?: AccumulateOptions) => UsageSummary;
  /** unsubscribe (the session also reaps the listener on stop). */
  detach: () => void;
}

/**
 * Subscribe to a session's `assistant.usage` events and accumulate them. Independent of the live
 * stream's `quiet` flag — cost is reported even on piped/CI runs (the whole point of #0014). Pure
 * accounting lives in {@link accumulateUsage}; this only collects the raw records.
 */
export function attachCostMeter(session: CopilotSession): CostMeter {
  const records: UsageRecord[] = [];
  const unsubscribe = session.on('assistant.usage', (event) => { records.push(event.data as UsageRecord); });
  return {
    getUsage: (opts) => accumulateUsage(records, opts),
    detach: unsubscribe,
  };
}
