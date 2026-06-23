// qa-focus VS Code chat participant (#0018, ADR 0007). Registers an `@qa-focus` participant in
// GitHub Copilot Chat. The participant OWNS THE LOOP — it is NOT a Language Model Tool and NOT an
// MCP server (the postures ADR 0001/0003 reject). On a request it parses the prompt, drives the
// git-installed qa-focus CLI (explore/codify — the gate + leash + model live there), and streams the
// run into the chat via ChatResponseStream. The model is the qa-focus copilot login; vscode.lm is a
// documented future option (ADR 0007). Pure parsing lives in ./request (unit-tested without VS Code).
import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import { parseChatRequest } from './request.js';

const HELP = [
  '**@qa-focus** — control-first agentic QA in Chat. I drive the qa-focus CLI (explore / codify) and',
  'stream the run here; the locator gate verifies every step. **No MCP.**',
  '',
  'Usage:',
  '- `@qa-focus https://your.app add a task and verify it appears` — explore (default).',
  '- `@qa-focus explore https://your.app <goal>` — discover a flow + emit evidence.',
  '- `@qa-focus codify https://your.app <goal>` — harden a flow into a gated Playwright spec.',
  '',
  'Install the CLI first (no npm registry — ADR 0006): `npm i -g github:dotts-h/qa-focus`.',
].join('\n');

/** Run `qa-focus <argv>` and stream its stdout (line by line) into the chat. Resolves on exit. */
function runQaFocus(argv: string[], cwd: string | undefined, token: vscode.CancellationToken, stream: vscode.ChatResponseStream): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('qa-focus', argv, { cwd, env: process.env });
    token.onCancellationRequested(() => child.kill());
    let buf = '';
    const pump = (chunk: Buffer) => {
      buf += chunk.toString();
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.trim()) stream.markdown(line + '\n');
      }
    };
    child.stdout.on('data', pump);
    child.stderr.on('data', pump);
    child.on('error', (e) => { stream.markdown(`\n⚠️ could not start qa-focus: ${e.message}. Is it installed? \`npm i -g github:dotts-h/qa-focus\`\n`); resolve(1); });
    child.on('close', (code) => { if (buf.trim()) stream.markdown(buf + '\n'); resolve(code ?? 0); });
  });
}

const handler: vscode.ChatRequestHandler = async (request, _ctx, stream, token) => {
  const parsed = parseChatRequest(request.prompt);
  if (parsed.mode === 'help') { stream.markdown(HELP); return {}; }
  if (parsed.error) { stream.markdown(`⚠️ ${parsed.error}`); return {}; }

  stream.progress(`Running qa-focus ${parsed.mode} against ${parsed.url}…`);
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const code = await runQaFocus(parsed.argv, cwd, token, stream);
  stream.markdown(code === 0 ? '\n✅ qa-focus run complete — review the evidence artifact in `artifacts/`.\n' : `\n❌ qa-focus exited ${code}.\n`);
  return {};
};

export function activate(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant('qa-focus', handler);
  context.subscriptions.push(participant);
}

export function deactivate(): void { /* nothing to clean up */ }
