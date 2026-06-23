// The live run-stream renderer — turns the Copilot SDK event stream into a Copilot-CLI-style
// terminal stream of the model's reasoning, output, and tool calls (#0013, epic 0012).
//
// Today the runners drive with blocking `session.sendAndWait(...)`, which returns only the final
// text and discards the whole event stream — so the operator goes dark until the end. Subscribing
// to `session.on(...)` (with `streaming: true`) surfaces the work as it happens. This module is the
// PURE half: `createStreamRenderer()` maps the event union to display text and is unit-tested with
// synthetic events (no model, no quota). The harness (ADR 0002) owns the actual subscription so the
// leash/tool-gating stays in one place; `attachStreamRenderer` is the thin wire between them.
//
// #0014 (cost accounting) rides the SAME event tap — keep the subscription in the harness seam.
import type { SessionEvent, CopilotSession } from '@github/copilot-sdk';

const THINK = '💭 ';
const TOOL = '🔧 ';
const OK = '✓';
const FAIL = '✗';
const ARG_MAX = 40; // truncate a single arg value so a tool line stays one terminal row

/** A pure renderer: feed it SDK events in order, write the strings it returns to a stream. */
export interface StreamRenderer {
  /** Map one SDK event to the text to write (may be ''). Stateful across calls (block bookkeeping). */
  render(event: SessionEvent): string;
  /** Terminate any open (un-newlined) block — call once when the stream ends. */
  flush(): string;
}

type Block = '' | 'reasoning' | 'message' | 'tool';

function formatVal(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v) ?? String(v);
  return s.length > ARG_MAX ? s.slice(0, ARG_MAX) + '…' : s;
}

// Compact a tool's arguments: a lone value shows bare (`browser_click(e5)`), several show as
// `key=value` pairs (`browser_fill(ref=e5, text=milk)`). Empty/absent → `()`.
function formatArgs(args: Record<string, unknown> | undefined): string {
  if (!args) return '';
  const entries = Object.entries(args);
  if (entries.length === 0) return '';
  if (entries.length === 1) return formatVal(entries[0][1]);
  return entries.map(([k, v]) => `${k}=${formatVal(v)}`).join(', ');
}

/**
 * Create a stateful-but-deterministic renderer. State is purely display bookkeeping: which block
 * (reasoning / assistant message / tool) is currently "open" without a trailing newline, plus which
 * reasoning/message ids already streamed via deltas (so a cumulative full event isn't printed twice).
 */
export function createStreamRenderer(): StreamRenderer {
  let block: Block = '';
  let openTool: string | null = null; // toolCallId of a 🔧 line still awaiting its result mark
  const toolNames = new Map<string, string>(); // toolCallId → name, for recap lines after progress
  const streamedReasoning = new Set<string>();
  const streamedMessage = new Set<string>();

  // Open a new block, breaking the previous open line if there was one.
  const open = (next: Exclude<Block, ''>): string => {
    const sep = block === '' ? '' : '\n';
    block = next;
    return sep;
  };

  return {
    render(event: SessionEvent): string {
      switch (event.type) {
        case 'assistant.reasoning_delta': {
          const { reasoningId, deltaContent } = event.data;
          // An empty delta carries no text — render nothing AND don't mark the block streamed, so a
          // later cumulative `assistant.reasoning` for the same id still prints (the runtime may emit
          // zero-length opening/closing deltas; the SDK only promises `deltaContent: string`).
          if (!deltaContent) return '';
          streamedReasoning.add(reasoningId);
          if (block === 'reasoning') return deltaContent;
          return open('reasoning') + THINK + deltaContent;
        }
        case 'assistant.reasoning': {
          const { reasoningId, content } = event.data;
          if (streamedReasoning.has(reasoningId) || !content) return '';
          return open('reasoning') + THINK + content;
        }
        case 'assistant.message_delta': {
          const { messageId, deltaContent } = event.data;
          // Empty delta: render nothing and don't mark streamed, so the cumulative `assistant.message`
          // still prints (otherwise a single zero-length delta would drop the whole final answer).
          if (!deltaContent) return '';
          streamedMessage.add(messageId);
          if (block === 'message') return deltaContent;
          return open('message') + deltaContent;
        }
        case 'assistant.message': {
          const { messageId, content } = event.data;
          if (streamedMessage.has(messageId) || !content) return '';
          return open('message') + content;
        }
        case 'tool.execution_start': {
          const { toolCallId, toolName, arguments: args } = event.data;
          toolNames.set(toolCallId, toolName);
          const out = open('tool') + TOOL + toolName + '(' + formatArgs(args) + ')';
          openTool = toolCallId;
          return out;
        }
        case 'tool.execution_progress': {
          const { progressMessage } = event.data;
          if (!progressMessage) return '';
          // Close the open 🔧 line (its result will recap with the tool name) and indent progress.
          const sep = block === 'tool' ? '\n' : '';
          block = '';
          openTool = null;
          return sep + '   ' + progressMessage + '\n';
        }
        case 'tool.execution_complete': {
          const { toolCallId, success, error } = event.data;
          const mark = success ? OK : FAIL;
          const suffix = success ? '' : ` ${error?.message ?? 'failed'}`;
          if (block === 'tool' && openTool === toolCallId) {
            // The 🔧 line is still open — finish it in place.
            block = '';
            openTool = null;
            return ` ${mark}${suffix}\n`;
          }
          // Progress (or another event) intervened — emit a standalone recap line, naming the tool
          // when we saw its start (drop the label entirely for an orphan completion, no trailing space).
          const name = toolNames.get(toolCallId);
          const label = name ? ` ${name}` : '';
          const sep = block === '' ? '' : '\n';
          block = '';
          return `${sep}   ${mark}${label}${suffix}\n`;
        }
        default:
          return '';
      }
    },
    flush(): string {
      if (block === '') return '';
      block = '';
      openTool = null;
      return '\n';
    },
  };
}

/** Options for {@link attachStreamRenderer}. */
export interface AttachStreamOptions {
  /** silence the stream (piped/CI runs) — no subscription, no writes. Default: stream on. */
  quiet?: boolean;
  /** sink for rendered text. Default: stdout. */
  write?: (s: string) => void;
}

/** Live-stream subscription handle returned by {@link attachStreamRenderer}. */
export interface StreamHandle {
  /**
   * Terminate any open (un-newlined) block by writing its trailing newline, then reset the renderer
   * to a clean state. Call at a turn boundary (e.g. between interactive REPL turns) so the next
   * turn's first line isn't joined to — or double-separated from — the previous turn's last line.
   */
  flush: () => void;
  /** Flush and unsubscribe. Call once at teardown. */
  detach: () => void;
}

/**
 * Wire a {@link createStreamRenderer} to a live session's event stream. Returns a {@link StreamHandle}
 * to flush at turn boundaries and detach at teardown. When `quiet`, it subscribes to nothing and
 * writes nothing (so a piped run pays no rendering cost). The session must be created with
 * `streaming: true` to receive the incremental reasoning/message deltas (the harness does this).
 */
export function attachStreamRenderer(session: CopilotSession, opts: AttachStreamOptions = {}): StreamHandle {
  if (opts.quiet) return { flush: () => {}, detach: () => {} };
  const write = opts.write ?? ((s: string) => process.stdout.write(s));
  const renderer = createStreamRenderer();
  const unsubscribe = session.on((event) => {
    const text = renderer.render(event);
    if (text) write(text);
  });
  const flush = (): void => {
    const tail = renderer.flush();
    if (tail) write(tail);
  };
  return { flush, detach: () => { flush(); unsubscribe(); } };
}
