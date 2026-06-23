// The unified CLI entrypoint (bin/qa-focus.mjs) — flag → harness-env mapping.
// Deterministic: parseArgs is pure; we never spawn a harness here.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs } from '../bin/qa-focus.mjs';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '../bin/qa-focus.mjs');

test('explore flags map onto the env contract', () => {
  const { cmd, env, unknown } = parseArgs(['explore', '--goal', 'Add a task', '--url', 'http://localhost:3000', '--channel', 'chrome', '--headed']);
  expect(cmd).toBe('explore');
  expect(env).toEqual({ GOAL: 'Add a task', START_URL: 'http://localhost:3000', PW_CHANNEL: 'chrome', HEADED: '1' });
  expect(unknown).toEqual([]);
});

test('codify flow-seeding flags map correctly', () => {
  const { cmd, env } = parseArgs(['codify', '--flow', 'artifacts/explore-flow.json', '--spec', 'todo-add', '--steps', '40']);
  expect(cmd).toBe('codify');
  expect(env).toEqual({ FLOW: 'artifacts/explore-flow.json', SPEC_NAME: 'todo-add', STEP_BUDGET: '40' });
});

test('unknown options are collected (not silently dropped)', () => {
  const { unknown } = parseArgs(['explore', '--bogus', '--goal', 'x']);
  expect(unknown).toEqual(['--bogus']);
});

test('--flag=value form is supported', () => {
  const { env, unknown } = parseArgs(['explore', '--goal=hello world', '--channel=chrome']);
  expect(env).toEqual({ GOAL: 'hello world', PW_CHANNEL: 'chrome' });
  expect(unknown).toEqual([]);
});

test('a value flag with no value is reported missing, never swallowed', () => {
  const end = parseArgs(['explore', '--goal']); // end of argv
  expect(end.missing).toEqual(['--goal']);
  expect(end.env.GOAL).toBeUndefined();
  const chained = parseArgs(['explore', '--url', '--goal', 'x']); // followed by another flag
  expect(chained.missing).toEqual(['--url']);
  expect(chained.env).toEqual({ GOAL: 'x' });
});

test('a missing value makes the CLI exit 2 (not a silent wrong-default run)', () => {
  let code = 0;
  try { execFileSync(process.execPath, [BIN, 'explore', '--goal'], { stdio: 'pipe' }); }
  catch (e: any) { code = e.status; }
  expect(code).toBe(2);
});

test('--help exits 0 and prints usage; importing parseArgs has no side effects', () => {
  const out = execFileSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' });
  expect(out).toMatch(/Usage: qa-focus <command>/);
  expect(out).toMatch(/explore[\s\S]*codify[\s\S]*interactive/);
});

test('an unknown command exits non-zero with usage', () => {
  let code = 0;
  try { execFileSync(process.execPath, [BIN, 'frobnicate'], { stdio: 'pipe' }); }
  catch (e: any) { code = e.status; }
  expect(code).toBe(2);
});
