// VS Code @qa-focus chat participant (#0018, epic 0015, ADR 0007). Validates the extension manifest
// (the participant contribution, no MCP) and the PURE request parser. Deterministic: no VS Code, no
// model. (The "runs in Copilot Chat" acceptance is verified by loading the extension in VS Code —
// can't be done headless here; the parse + manifest are what CI guards.)
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseChatRequest } from '../vscode/src/request.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = () => JSON.parse(readFileSync(join(ROOT, 'vscode/package.json'), 'utf8'));

test('the extension manifest registers an @qa-focus chat participant', () => {
  const m = manifest();
  expect(m.engines?.vscode).toBeTruthy(); // a VS Code extension
  expect(m.main).toBeTruthy();
  const parts = m.contributes?.chatParticipants;
  expect(Array.isArray(parts)).toBe(true);
  const p = parts.find((x: any) => x.id === 'qa-focus');
  expect(p, 'qa-focus participant').toBeTruthy();
  expect(p.name).toBe('qa-focus');
});

test('the extension wires NO MCP and NO Language Model Tool (ADR 0007 — participant owns the loop)', () => {
  const m = JSON.stringify(manifest()).toLowerCase();
  expect(m).not.toContain('languagemodeltools'); // not a tool the host invokes
  expect(m).not.toContain('mcpservers');
  expect(m).not.toContain('modelcontextprotocol');
  // and the extension source spawns the CLI, never registers a tool / MCP server (advertising the
  // word "MCP" in help text is fine — ban the actual wiring).
  const src = readFileSync(join(ROOT, 'vscode/src/extension.ts'), 'utf8').toLowerCase();
  expect(src).not.toContain('registertool');
  expect(src).not.toContain('registerlanguagemodeltool');
  expect(src).not.toContain('modelcontextprotocol');
  expect(src).not.toContain('mcpserver');
  expect(src).toContain('createchatparticipant'); // it IS a participant
});

test('parseChatRequest defaults to explore and extracts the URL + goal', () => {
  const r = parseChatRequest('https://your.app add a task and verify it appears');
  expect(r.mode).toBe('explore');
  expect(r.url).toBe('https://your.app');
  expect(r.goal).toBe('add a task and verify it appears');
  expect(r.argv).toEqual(['explore', '--url', 'https://your.app', '--quiet', '--goal', 'add a task and verify it appears']);
});

test('parseChatRequest honours an explicit explore/codify mode and strips quotes from the goal', () => {
  const r = parseChatRequest('codify https://shop.test "checkout flow"');
  expect(r.mode).toBe('codify');
  expect(r.url).toBe('https://shop.test');
  expect(r.goal).toBe('checkout flow'); // quotes stripped
  expect(r.argv.slice(0, 4)).toEqual(['codify', '--url', 'https://shop.test', '--quiet']);
});

test('parseChatRequest returns help for empty / "help", and an error when no URL is given', () => {
  expect(parseChatRequest('').mode).toBe('help');
  expect(parseChatRequest('help').mode).toBe('help');
  const noUrl = parseChatRequest('explore add a task');
  expect(noUrl.error).toMatch(/no URL/i);
  expect(noUrl.argv).toEqual([]); // nothing to run
});

test('parseChatRequest finds the URL even when it is not first, and omits --goal when none', () => {
  const r = parseChatRequest('explore https://a.example');
  expect(r.url).toBe('https://a.example');
  expect(r.goal).toBeUndefined();
  expect(r.argv).toEqual(['explore', '--url', 'https://a.example', '--quiet']); // no --goal
});
