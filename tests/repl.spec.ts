// Streamable REPL building blocks (src/repl.mts) — the pure glue for #0016 (epic 0015, ADR 0008).
// The model streams partial chunks; to render them as clean lines ABOVE a live input prompt
// (preserving what the user is typing) we line-buffer the chunks and redraw the prompt per line.
// Both helpers take injected sinks so they're deterministic — no readline, no TTY, no model.
import { test, expect } from '@playwright/test';
import { createLineWriter, writeAbovePrompt } from '../src/repl.mjs';

test('createLineWriter emits complete lines and buffers the trailing partial', () => {
  const out: string[] = [];
  const w = createLineWriter((line) => out.push(line));
  w.write('💭 Let me '); // no newline yet → buffered, nothing emitted
  expect(out).toEqual([]);
  w.write('think.\nand act.'); // first line completes; "and act." stays buffered
  expect(out).toEqual(['💭 Let me think.']);
  w.write('\n');
  expect(out).toEqual(['💭 Let me think.', 'and act.']);
});

test('createLineWriter splits multiple newlines in a single chunk', () => {
  const out: string[] = [];
  const w = createLineWriter((l) => out.push(l));
  w.write('a\nb\nc\n');
  expect(out).toEqual(['a', 'b', 'c']);
});

test('createLineWriter.flush emits a trailing partial line, then is idempotent', () => {
  const out: string[] = [];
  const w = createLineWriter((l) => out.push(l));
  w.write('partial');
  w.flush();
  expect(out).toEqual(['partial']);
  w.flush(); // buffer already empty → nothing more
  expect(out).toEqual(['partial']);
});

test('createLineWriter.flush is a no-op when the buffer is empty', () => {
  const out: string[] = [];
  const w = createLineWriter((l) => out.push(l));
  w.write('a\n');
  w.flush();
  expect(out).toEqual(['a']); // only the complete line, no empty trailing emit
});

test('writeAbovePrompt clears the line, prints the text, then redraws the prompt — in that order', () => {
  const calls: string[] = [];
  writeAbovePrompt({
    clearLine: () => calls.push('clear'),
    cursorTo0: () => calls.push('cursor'),
    write: (s) => calls.push(`write:${JSON.stringify(s)}`),
    redrawPrompt: () => calls.push('redraw'),
  }, '🔧 browser_click(e5) ✓');
  // clear the current (prompt+input) line → print the streamed line on its own row → redraw the
  // prompt with the user's in-progress input intact.
  expect(calls).toEqual(['clear', 'cursor', 'write:"🔧 browser_click(e5) ✓\\n"', 'redraw']);
});
