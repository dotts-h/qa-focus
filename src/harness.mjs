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

/**
 * Create a session whose entire capability surface is the given gated tools.
 *
 * @param {object}   o
 * @param {string}   o.cli         path to the Copilot CLI (RuntimeConnection.forStdio).
 * @param {string}  [o.model]      optional model override.
 * @param {Array<{name,def}>} o.tools  gated tool descriptors (from makeBrowserTools/makeCodifyTools).
 * @param {number}  [o.stepBudget] circuit-breaker: deny tool calls past this count (undefined = no cap).
 * @param {Function}[o.recency]    onUserPromptSubmitted hook () => ({ additionalContext }) | undefined.
 * @returns {Promise<{ session, client, toolNames: Set<string> }>}
 */
export async function createGatedSession({ cli, model, tools, stepBudget, recency }) {
  const defined = tools.map(({ name, def }) => defineTool(name, def));
  const toolNames = new Set(defined.map((t) => t.name ?? t.definition?.name).filter(Boolean));
  let steps = 0;

  const client = new CopilotClient({ connection: RuntimeConnection.forStdio({ path: cli }) });
  const session = await client.createSession({
    ...(model ? { model } : {}),
    tools: defined,
    availableTools: new ToolSet().addCustom('*'), // the leash: no fs/shell/network tools exist
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
  return { session, client, toolNames };
}
