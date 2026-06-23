// GitHub Action adapter (#0008, epic 0001) — validate the composite action manifest + its run script
// + the example workflow. Deterministic: parse the committed YAML/shell, no Actions runner, no model.
// (Running the Action end-to-end needs a real runner + a copilot token for explore/codify; the gate
// mode's dispatch is smoke-tested separately. These lock the manifest STRUCTURE so a future edit that
// breaks an input/output, drops the no-MCP posture, or mis-triggers the example fails CI.)
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { load as parseYaml } from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACTION_DIR = join(ROOT, '.github/actions/qa-focus');
const RUN_SH = join(ACTION_DIR, 'run.sh');
const readYaml = (p: string): any => parseYaml(readFileSync(p, 'utf8'));

test('action.yml is a composite action with the documented inputs and outputs', () => {
  const a = readYaml(join(ACTION_DIR, 'action.yml'));
  expect(a.name).toBeTruthy();
  expect(a.runs?.using).toBe('composite');
  // inputs the charter requires: mode, goal, start-url, channel, flow path
  for (const k of ['mode', 'goal', 'url', 'channel', 'flow']) {
    expect(a.inputs?.[k], `input ${k}`).toBeTruthy();
  }
  expect(a.inputs.mode.default).toBe('gate'); // the no-auth mode is the safe default
  // outputs: the evidence artifact + durable flow + the run result
  for (const k of ['artifact', 'flow', 'result']) {
    expect(a.outputs?.[k]?.value, `output ${k}`).toBeTruthy();
  }
});

test('the composite steps install qa-focus from GIT (ADR 0006) + playwright, then run the dispatch script', () => {
  const a = readYaml(join(ACTION_DIR, 'action.yml'));
  const steps = a.runs.steps as any[];
  const text = JSON.stringify(steps);
  expect(text).toContain('github:dotts-h/qa-focus'); // git install, not an npm registry (ADR 0006)
  expect(text).toMatch(/playwright install/); // browser binaries
  expect(text).toContain('run.sh'); // the mode-dispatch script
  expect(existsSync(join(ACTION_DIR, 'run.sh')), 'run.sh exists').toBe(true);
});

test('run.sh dispatches the three modes and writes job outputs', () => {
  const sh = readFileSync(join(ACTION_DIR, 'run.sh'), 'utf8');
  for (const mode of ['gate', 'explore', 'codify']) expect(sh).toContain(mode);
  expect(sh).toMatch(/GITHUB_OUTPUT/); // sets step outputs
  expect(sh).toContain('qa-focus'); // drives the CLI
  expect(sh).toMatch(/set -euo pipefail/); // fail-closed
});

test('the action wires NO MCP server (ADR 0001/0003) — advertising "No MCP" is fine', () => {
  const a = JSON.stringify(readYaml(join(ACTION_DIR, 'action.yml'))).toLowerCase();
  const sh = readFileSync(join(ACTION_DIR, 'run.sh'), 'utf8').toLowerCase();
  // ban actual MCP wiring, not the (good) advertising phrase "no mcp"
  for (const needle of ['mcpservers', 'mcp.json', '@playwright/mcp', 'modelcontextprotocol', 'mcp-server', 'mcp server config']) {
    expect(a, `action.yml has no ${needle}`).not.toContain(needle);
    expect(sh, `run.sh has no ${needle}`).not.toContain(needle);
  }
});

test('run.sh exits non-zero with a clear message on an unknown mode (dispatch guard)', () => {
  let code = 0;
  let stderr = '';
  try {
    execFileSync('bash', [RUN_SH], { env: { ...process.env, QA_MODE: 'bogus', GITHUB_OUTPUT: '/dev/null' }, stdio: 'pipe' });
  } catch (e: any) { code = e.status; stderr = String(e.stderr || ''); }
  expect(code).toBe(2);
  expect(stderr).toMatch(/unknown mode 'bogus'/);
});

test('run.sh STILL emits result=fail when explore fails (the set -e / emit-on-failure guard)', () => {
  // The explorer process.exit(1)s on failure; under `set -euo pipefail` that must NOT skip the
  // output emit. Stub `qa-focus` to fail, run the explore branch, assert result=fail is still written
  // (and the script propagates the non-zero exit).
  const work = mkdtempSync(join(tmpdir(), 'qa-action-'));
  try {
    const bin = join(work, 'qa-focus');
    writeFileSync(bin, '#!/usr/bin/env bash\nexit 1\n');
    chmodSync(bin, 0o755);
    const outFile = join(work, 'gh_output');
    writeFileSync(outFile, '');
    let code = 0;
    try {
      execFileSync('bash', [RUN_SH], {
        cwd: work,
        env: { ...process.env, PATH: `${work}:${process.env.PATH}`, QA_MODE: 'explore', GITHUB_OUTPUT: outFile },
        stdio: 'pipe',
      });
    } catch (e: any) { code = e.status; }
    const out = readFileSync(outFile, 'utf8');
    expect(code, 'the failed explore propagates a non-zero exit').not.toBe(0);
    expect(out, 'result=fail is emitted despite the failure').toContain('result=fail');
    expect(out).toMatch(/artifact=/); // the artifact/flow paths are still surfaced
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('the example workflow is manual-only (workflow_dispatch) so it never auto-runs CI', () => {
  const wf = readYaml(join(ROOT, '.github/workflows/qa-focus-example.yml'));
  const on = wf.on ?? wf[true]; // bare `on:` can parse as YAML boolean true
  expect(on.workflow_dispatch !== undefined, 'has workflow_dispatch').toBe(true);
  expect(on.push, 'no push trigger (would auto-run + need a token)').toBeUndefined();
  // it references the local composite action
  expect(JSON.stringify(wf)).toContain('.github/actions/qa-focus');
});
