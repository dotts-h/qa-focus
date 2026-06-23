// Streamable REPL building blocks (#0016, epic 0015) — render the live model stream as clean lines
// ABOVE a live input prompt, on plain Node readline ([ADR 0008](docs/adr/0008-streamable-repl-on-readline-not-ink.md);
// no Ink — it flickers and fights the in-process Playwright browser for stdout).
//
// The model streams PARTIAL chunks (a token delta has no newline until its line completes); to keep
// the prompt redraw stable we line-buffer the chunks and act once per COMPLETE line. Both helpers
// take injected sinks, so the logic is deterministic and unit-tested without a readline/TTY.
import { clearLine, cursorTo } from 'node:readline';
import type { Interface as ReadlineInterface } from 'node:readline';

/** Accumulates partial stream chunks and calls `emit(line)` once per complete (newline-terminated) line. */
export interface LineWriter {
  /** feed a (possibly partial, possibly multi-line) chunk. */
  write(chunk: string): void;
  /** emit any buffered trailing partial line (call at a turn boundary). Idempotent. */
  flush(): void;
}

export function createLineWriter(emit: (line: string) => void): LineWriter {
  let buf = '';
  return {
    write(chunk: string): void {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        emit(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    },
    flush(): void {
      if (buf) { emit(buf); buf = ''; }
    },
  };
}

/** The terminal operations writeAbovePrompt needs — injected so the sequence is testable. */
export interface PromptSurface {
  clearLine(): void;
  cursorTo0(): void;
  write(s: string): void;
  redrawPrompt(): void;
}

/**
 * Print `text` on its own line above the prompt without clobbering the user's in-progress input:
 * clear the current (prompt+input) line, write the streamed line, then redraw the prompt + input.
 */
export function writeAbovePrompt(surface: PromptSurface, text: string): void {
  surface.clearLine();
  surface.cursorTo0();
  surface.write(text + '\n');
  surface.redrawPrompt();
}

/** Build a {@link PromptSurface} backed by a real readline interface + output stream. */
export function readlinePromptSurface(rl: ReadlineInterface, out: NodeJS.WriteStream): PromptSurface {
  return {
    clearLine: () => { clearLine(out, 0); },
    cursorTo0: () => { cursorTo(out, 0); },
    write: (s) => { out.write(s); },
    redrawPrompt: () => { rl.prompt(true); }, // preserveCursor=true → keep the user's typed input
  };
}
