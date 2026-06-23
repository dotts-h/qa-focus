// Copilot CLI plugin packaging (#0007, epic 0001) — validate the plugin.json + marketplace.json
// manifests and the no-MCP guarantee (ADR 0003). Deterministic: parse the committed JSON/markdown,
// no copilot binary, no model. The end-to-end "loads in a copilot --experimental session" check is
// opt-in / manual (it needs the copilot login); these lock the manifest STRUCTURE so a future edit
// that breaks the schema or smuggles in an MCP server fails CI.
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_DIR = join(ROOT, 'plugins/qa-focus');
const readJSON = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const KEBAB = /^[a-z0-9-]+$/;

test('plugin.json is a valid manifest: kebab name, repo metadata, Apache-2.0', () => {
  const m = readJSON(join(PLUGIN_DIR, 'plugin.json'));
  expect(m.name).toBe('qa-focus');
  expect(m.name).toMatch(KEBAB);
  expect(m.name.length).toBeLessThanOrEqual(64);
  expect(m.license).toBe('Apache-2.0');
  expect(m.repository).toContain('github.com/dotts-h/qa-focus');
  expect(typeof m.description).toBe('string');
});

test('the plugin bundles NO MCP server and NO LSP server (ADR 0001/0003 — zero MCP, ever)', () => {
  const m = readJSON(join(PLUGIN_DIR, 'plugin.json'));
  expect(m.mcpServers).toBeUndefined();
  expect(m.lspServers).toBeUndefined();
  // and no MCP config file is shipped in the plugin dir under any of its accepted names
  for (const f of ['.mcp.json', 'mcp.json', '.github/mcp.json']) {
    expect(existsSync(join(PLUGIN_DIR, f)), `no MCP config (${f})`).toBe(false);
  }
});

test('the plugin contributes a skill that exists with name + description frontmatter', () => {
  const m = readJSON(join(PLUGIN_DIR, 'plugin.json'));
  // skills resolves to a dir (string or array of paths) under the plugin root
  const skillPaths = Array.isArray(m.skills) ? m.skills : [m.skills ?? 'skills/'];
  // every declared skills dir exists and at least one SKILL.md lives under it
  const skillFiles: string[] = [];
  for (const sp of skillPaths) {
    const dir = join(PLUGIN_DIR, sp);
    expect(existsSync(dir), `skills dir ${sp} exists`).toBe(true);
    for (const sub of readdirSync(dir, { withFileTypes: true })) {
      const skill = join(dir, sub.name, 'SKILL.md');
      if (sub.isDirectory() && existsSync(skill)) skillFiles.push(skill);
    }
  }
  expect(skillFiles.length).toBeGreaterThanOrEqual(1);
  const body = readFileSync(skillFiles[0], 'utf8');
  expect(body.startsWith('---')).toBe(true); // YAML frontmatter
  expect(body).toMatch(/\nname:\s*\S/); // name field
  expect(body).toMatch(/\ndescription:\s*\S/); // description field
  expect(body.toLowerCase()).toContain('qa-focus'); // the skill actually teaches driving qa-focus
});

test('marketplace.json lists the plugin and points source at the real plugin dir', () => {
  const mk = readJSON(join(ROOT, '.github/plugin/marketplace.json'));
  expect(mk.name).toMatch(KEBAB);
  expect(mk.owner?.name).toBeTruthy();
  expect(Array.isArray(mk.plugins)).toBe(true);
  const entry = mk.plugins.find((p: any) => p.name === 'qa-focus');
  expect(entry, 'qa-focus listed in the marketplace').toBeTruthy();
  expect(entry.source).toBeTruthy();
  // the source path resolves to the plugin dir that holds plugin.json
  expect(existsSync(join(ROOT, entry.source, 'plugin.json')), `source ${entry.source} holds plugin.json`).toBe(true);
});

test('the marketplace bundles no MCP either (entry-level guard)', () => {
  const mk = readJSON(join(ROOT, '.github/plugin/marketplace.json'));
  for (const p of mk.plugins) expect(p.mcpServers).toBeUndefined();
});
