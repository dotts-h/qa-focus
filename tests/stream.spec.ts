// The live run-stream renderer (src/stream.mts) — the pure events→lines mapping that turns the
// Copilot SDK event union into a Copilot-CLI-style stream of reasoning, assistant output, and tool
// calls (#0013, epic 0012). Deterministic: synthetic events in, display text out — no model, no
// quota. The harness owns the `session.on` subscription (ADR 0002); this only renders.
import { test, expect } from '@playwright/test';
import { createStreamRenderer, attachStreamRenderer } from '../src/stream.mjs';

// Minimal synthetic-event helpers — only the fields the renderer reads (the SDK union is huge).
const rDelta = (reasoningId: string, deltaContent: string): any => ({ type: 'assistant.reasoning_delta', data: { reasoningId, deltaContent } });
const reasoning = (reasoningId: string, content: string): any => ({ type: 'assistant.reasoning', data: { reasoningId, content } });
const mDelta = (messageId: string, deltaContent: string): any => ({ type: 'assistant.message_delta', data: { messageId, deltaContent } });
const message = (messageId: string, content: string): any => ({ type: 'assistant.message', data: { messageId, content } });
const toolStart = (toolCallId: string, toolName: string, args?: Record<string, unknown>): any => ({ type: 'tool.execution_start', data: { toolCallId, toolName, arguments: args } });
const toolProgress = (toolCallId: string, progressMessage: string): any => ({ type: 'tool.execution_progress', data: { toolCallId, progressMessage } });
const toolDone = (toolCallId: string, success: boolean, error?: { message: string }): any => ({ type: 'tool.execution_complete', data: { toolCallId, success, error } });

// Drive a fresh renderer through a list of events and return the full concatenated output
// (the same bytes the harness would write to the terminal), trailing flush included.
function play(events: any[]): string {
  const r = createStreamRenderer();
  let out = '';
  for (const e of events) out += r.render(e);
  out += r.flush();
  return out;
}

test('reasoning deltas accumulate under a single 💭 prefix', () => {
  expect(play([rDelta('r1', 'Let me '), rDelta('r1', 'think.')])).toBe('💭 Let me think.\n');
});

test('a reasoning→message transition inserts a line break, message text has no prefix', () => {
  expect(play([rDelta('r1', 'hmm'), mDelta('m1', 'Hello'), mDelta('m1', ' world')])).toBe('💭 hmm\nHello world\n');
});

test('a full reasoning event renders when no deltas streamed it', () => {
  expect(play([reasoning('r1', 'a complete thought')])).toBe('💭 a complete thought\n');
});

test('a full reasoning event is suppressed when its deltas already streamed (no duplication)', () => {
  // Some runtimes emit both the incremental deltas AND the cumulative full event for a block.
  expect(play([rDelta('r1', 'abc'), reasoning('r1', 'abc')])).toBe('💭 abc\n');
});

test('a full message event is suppressed when its deltas already streamed', () => {
  expect(play([mDelta('m1', 'done.'), message('m1', 'done.')])).toBe('done.\n');
});

test('a full message event renders when streaming was off (no deltas)', () => {
  expect(play([message('m1', 'the answer')])).toBe('the answer\n');
});

test('a tool call renders name + compact single arg, then a success mark on the same line', () => {
  expect(play([toolStart('t1', 'browser_click', { ref: 'e5' }), toolDone('t1', true)])).toBe('🔧 browser_click(e5) ✓\n');
});

test('a failed tool call renders ✗ with the error message', () => {
  expect(play([toolStart('t1', 'browser_click', { ref: 'e5' }), toolDone('t1', false, { message: 'no such element' })]))
    .toBe('🔧 browser_click(e5) ✗ no such element\n');
});

test('multiple tool args render as key=value pairs', () => {
  expect(play([toolStart('t1', 'browser_fill', { ref: 'e5', text: 'milk' }), toolDone('t1', true)]))
    .toBe('🔧 browser_fill(ref=e5, text=milk) ✓\n');
});

test('a tool with no args renders empty parens', () => {
  expect(play([toolStart('t1', 'browser_snapshot'), toolDone('t1', true)])).toBe('🔧 browser_snapshot() ✓\n');
});

test('a progress event closes the tool line; the later completion recaps with the tool name', () => {
  expect(play([toolStart('t1', 'run_spec', { name: 'add.spec.ts' }), toolProgress('t1', 'running 1 test'), toolDone('t1', true)]))
    .toBe('🔧 run_spec(add.spec.ts)\n   running 1 test\n   ✓ run_spec\n');
});

test('reasoning, a tool call, then the final message stream in order', () => {
  const out = play([
    rDelta('r1', 'I will add a task.'),
    toolStart('t1', 'browser_fill', { ref: 'e5', text: 'milk' }),
    toolDone('t1', true),
    mDelta('m1', 'Added the task.'),
  ]);
  expect(out).toBe('💭 I will add a task.\n🔧 browser_fill(ref=e5, text=milk) ✓\nAdded the task.\n');
});

test('long string args are truncated so the stream stays one line', () => {
  const long = 'x'.repeat(80);
  const out = play([toolStart('t1', 'browser_fill', { text: long }), toolDone('t1', true)]);
  expect(out).toContain('…');
  expect(out.length).toBeLessThan(80);
});

test('unknown / irrelevant event types render nothing', () => {
  expect(play([{ type: 'assistant.streaming_delta', data: { totalResponseSizeBytes: 42 } } as any])).toBe('');
  expect(play([{ type: 'session.idle', data: {} } as any])).toBe('');
});

test('flush is a no-op when no block is open', () => {
  const r = createStreamRenderer();
  expect(r.flush()).toBe('');
});

// --- attachStreamRenderer: the thin session.on wiring (impure, fake-session tested) ---

function fakeSession() {
  let handler: ((e: any) => void) | null = null;
  return {
    on(h: any) { handler = h; return () => { handler = null; }; },
    emit(e: any) { handler?.(e); },
    get subscribed() { return handler !== null; },
  };
}

test('attachStreamRenderer subscribes and writes rendered output; detach flushes + unsubscribes', () => {
  const s = fakeSession();
  let buf = '';
  const detach = attachStreamRenderer(s as any, { write: (x) => { buf += x; } });
  expect(s.subscribed).toBe(true);
  s.emit(rDelta('r1', 'thinking'));
  expect(buf).toBe('💭 thinking');
  detach(); // flushes the trailing newline and unsubscribes
  expect(buf).toBe('💭 thinking\n');
  expect(s.subscribed).toBe(false);
});

test('attachStreamRenderer with quiet:true does not subscribe or write', () => {
  const s = fakeSession();
  let buf = '';
  const detach = attachStreamRenderer(s as any, { quiet: true, write: (x) => { buf += x; } });
  expect(s.subscribed).toBe(false);
  s.emit(mDelta('m1', 'hi'));
  expect(buf).toBe('');
  detach();
  expect(buf).toBe('');
});
