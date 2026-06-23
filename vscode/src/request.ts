// Pure parsing for the @qa-focus chat participant (#0018) — no `vscode` import, so it's unit-tested
// without the editor. VS Code strips the `@qa-focus` mention and hands the handler the remaining
// prompt; this turns that prompt into a qa-focus CLI invocation (the participant owns the loop —
// ADR 0007). Keeping it pure mirrors the project's "thin adapters over a portable, testable core".

export type ChatMode = 'explore' | 'codify' | 'help';

export interface ChatRequest {
  mode: ChatMode;
  url?: string;
  goal?: string;
  /** the qa-focus CLI argv this maps to (empty for help). */
  argv: string[];
  error?: string;
}

const URL_RE = /\bhttps?:\/\/[^\s"']+/i;

/**
 * Parse a chat prompt (the text after `@qa-focus`) into a qa-focus command. Forms:
 *   "<url> <goal…>"                 → explore (default mode)
 *   "explore <url> <goal…>"
 *   "codify <url> <goal…>"          (codify a flow against the app)
 *   "help" / ""                     → help
 * The URL may appear anywhere; the remaining words (quotes stripped) are the goal.
 */
export function parseChatRequest(prompt: string): ChatRequest {
  const text = (prompt ?? '').trim();
  if (!text || /^help\b/i.test(text)) return { mode: 'help', argv: [] };

  let rest = text;
  let mode: ChatMode = 'explore';
  const first = rest.split(/\s+/)[0]?.toLowerCase();
  if (first === 'explore' || first === 'codify') {
    mode = first;
    rest = rest.slice(first.length).trim();
  }

  const urlMatch = rest.match(URL_RE);
  const url = urlMatch?.[0];
  if (!url) {
    return { mode, error: 'no URL found — try: `@qa-focus explore https://your.app add a task and verify it appears`', argv: [] };
  }

  const goal = rest.replace(url, ' ').replace(/["']/g, '').replace(/\s+/g, ' ').trim();
  const argv = [mode, '--url', url, '--quiet'];
  if (goal) argv.push('--goal', goal);

  return { mode, url, goal: goal || undefined, argv };
}
