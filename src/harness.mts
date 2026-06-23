// The gated-session control model — ONE home for the hard leash (ADR 0002).
//
// Every autonomous/enforcing runner (bin/explore, bin/codify, bin/interactive) drives
// the model through the SAME control model that ARCHITECTURE.md §"Control is the engine"
// describes: the program owns the loop, the model only acts through custom typed tools,
// and a per-call policy denies everything else. That leash IS the prompt-injection defense
// (ADR 0001), so it must have a single definition, not three hand-synced copies.
//
// This is the only module (besides the extension's joinSession) that imports the Copilot
// SDK session primitives — the SDK seam stays narrow.
import { CopilotClient, RuntimeConnection, ToolSet, defineTool, approveAll } from '@github/copilot-sdk';
import type { CopilotClient as CopilotClientType, CopilotSession } from '@github/copilot-sdk';
import type { ToolDescriptor } from './tool.mjs';
import { attachStreamRenderer } from './stream.mjs';
import { attachCostMeter } from './cost.mjs';
import type { AccumulateOptions, UsageSummary } from './cost.mjs';

/** Options for `createGatedSession` — the hard leash (cage + deny + budget). */
export interface GatedSessionOptions {
  /** path to the Copilot CLI (RuntimeConnection.forStdio). */
  cli: string;
  /** optional model override. */
  model?: string;
  /** gated tool descriptors (from makeBrowserTools/makeCodifyTools). */
  tools: ToolDescriptor[];
  /** circuit-breaker: deny tool calls past this count (undefined = no cap). */
  stepBudget?: number;
  /** onUserPromptSubmitted hook () => ({ additionalContext }) | undefined. */
  recency?: (...args: any[]) => any;
  /**
   * Silence the live run stream (#0013). Default false → the model's reasoning, output, and tool
   * calls render to stdout as they happen (Copilot-CLI style). True for piped/CI runs (`--quiet` /
   * `QA_QUIET`): no event subscription, no writes, and `streaming` left off to save the deltas.
   */
  quiet?: boolean;
}

/** The created session, its client, the set of allowed tool names, and the live-stream controls. */
export interface GatedSession {
  session: CopilotSession;
  client: CopilotClientType;
  toolNames: Set<string>;
  /** Terminate the current run-stream block (trailing newline) at a turn boundary (no-op when quiet). */
  flushStream: () => void;
  /** Flush + unsubscribe the live run-stream renderer. Call once at teardown (no-op when quiet). */
  detachStream: () => void;
  /** The run's token + AI-Credits usage so far (#0014). Reported even on piped/CI runs. */
  getUsage: (opts?: AccumulateOptions) => UsageSummary;
}

/**
 * Create a session whose entire capability surface is the given gated tools.
 */
export async function createGatedSession({ cli, model, tools, stepBudget, recency, quiet }: GatedSessionOptions): Promise<GatedSession> {
  const defined = tools.map(({ name, def }) => defineTool(name, def));
  const toolNames = new Set(defined.map((t) => t.name).filter(Boolean));
  let steps = 0;

  const client = new CopilotClient({ connection: RuntimeConnection.forStdio({ path: cli }) });
  const session = await client.createSession({
    ...(model ? { model } : {}),
    tools: defined,
    availableTools: new ToolSet().addCustom('*'), // the leash: no fs/shell/network tools exist
    streaming: !quiet, // emit incremental reasoning/message deltas for the live run stream (#0013)
    onPermissionRequest: approveAll,
    hooks: {
      ...(recency ? { onUserPromptSubmitted: recency } : {}),
      onPreToolUse: async ({ toolName }) => {
        if (!toolNames.has(toolName)) {
          return { permissionDecision: 'deny', permissionDecisionReason: `not a qa-focus tool: ${toolName}` };
        }
        if (stepBudget && ++steps > stepBudget) {
          return { permissionDecision: 'deny', permissionDecisionReason: `step budget (${stepBudget}) exhausted — stop and report your results now` };
        }
        return undefined;
      },
    },
  });

  // Both observability features ride this one seam (ADR 0002), so all three runners get them for
  // free. The live run stream (#0013) honours `quiet`; the cost meter (#0014) does NOT — usage is
  // reported even on piped/CI runs. Both pure-accounting halves live in src/{stream,cost}.mts.
  const { flush: flushStream, detach: detachStream } = attachStreamRenderer(session, { quiet });
  const { getUsage } = attachCostMeter(session);

  return { session, client, toolNames, flushStream, detachStream, getUsage };
}
