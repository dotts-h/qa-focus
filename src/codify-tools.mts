// Shared CODIFIER tools — turn a discovered flow into a durable, standards-compliant
// Playwright test, used by BOTH the interactive Copilot extension and the hard-leash
// interactive REPL (bin/interactive.mts), so there is one implementation.
//
//   • propose_locator — grade ONE locator against the CURRENT live page by the priority
//     ladder (ladder.mts); supports `scope` (accessible ancestor) and `frame` (iframe).
//   • write_spec       — write tests/authored/<name>.spec.ts, REJECTED if it breaks the
//     deterministic Playwright-standards linter (standards.mts).
//   • run_spec         — run the authored spec through `playwright test` (the real gate).
//
// `getCtx` is async () => { page } resolved per call (lazy browser). `facts` is a
// caller-owned array of accepted-locator facts (re-injected each turn for recency).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import type { Page } from 'playwright';
import { gradeLocator, render } from '../extension/qa-focus/ladder.mjs';
import { lintSpec, renderViolations } from './standards.mjs';
import { healLocator } from './healer.mjs';
import type { ToolDef, ToolDescriptor, ToolResult } from './tool.mjs';

const slug = (s: string): string => String(s || 'flow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'flow';

/** Inputs to the codifier-tool factory. `getCtx` resolves the live page per call. */
export interface CodifyToolsOptions {
  getCtx: () => Promise<{ page: Page }>;
  root: string;
  facts?: string[];
}

export function makeCodifyTools({ getCtx, root, facts = [] }: CodifyToolsOptions): ToolDescriptor[] {
  const tool = (name: string, def: ToolDef): ToolDescriptor => ({ name, def });

  return [
    tool('propose_locator', {
      description:
        'Propose ONE durable locator for the CURRENT page, graded by the priority ladder ' +
        '(role > label > placeholder > text > altText > title > testid > scoped > css/xpath). ' +
        'For non-unique accessible names pass `scope` (an accessible parent such as a table row) + child role/name. ' +
        'For an element inside an IFRAME pass `frame` (an <iframe> CSS selector) → rendered as page.frameLocator(...).…. ' +
        'Open shadow DOM is auto-pierced; XPath does NOT pierce shadow DOM. css/xpath are last-resort and REQUIRE a "reason". ' +
        'Returns the validated Playwright expression, or a rejection naming the better tier.',
      parameters: {
        type: 'object',
        required: ['tier'],
        properties: {
          tier: { enum: ['role', 'label', 'placeholder', 'text', 'altText', 'title', 'testid', 'css', 'xpath'] },
          intent: { type: 'string' }, role: { type: 'string' }, name: { type: 'string' },
          scope: { type: 'object', properties: { tier: { type: 'string' }, role: { type: 'string' }, name: { type: 'string' }, expression: { type: 'string' }, exact: { type: 'boolean' } } },
          frame: { type: 'string', description: 'CSS selector for the containing <iframe>, when the element lives inside one' },
          expression: { type: 'string' }, exact: { type: 'boolean' }, reason: { type: 'string' },
        },
      },
      skipPermission: true,
      handler: async (p) => {
        const { page } = await getCtx();
        const v = await gradeLocator(page, p);
        if (!v.ok) {
          const hint = v.suggestion ? ` Use ${v.suggestion}.` : v.suggestedTier ? ` Try tier "${v.suggestedTier}".` : '';
          return { textResultForLlm: `REJECTED: ${v.reason}.${hint}`, resultType: 'failure' };
        }
        const code = render(p);
        facts.push(`"${p.intent || code}" → ${code} (${v.tier}${v.degraded ? ', DEBT' : ''}).`);
        return { textResultForLlm: `ACCEPTED at tier "${v.tier}". Use:\n${code}${v.degraded ? '\n(logged as accessibility debt — file a ticket to add an accessible handle)' : ''}`, resultType: 'success' };
      },
    }),
    tool('write_spec', {
      description: 'Write a Playwright test file under tests/authored/<name>.spec.ts. Use only gate-ACCEPTED locators (from propose_locator). The source is linted against Playwright standards (no hard sleeps, no networkidle, no raw element handles, no XPath) and REJECTED if it violates them. Then call run_spec to verify it passes.',
      parameters: { type: 'object', required: ['name', 'code'], properties: { name: { type: 'string' }, code: { type: 'string', description: 'full .spec.ts source' } } },
      handler: async (a) => {
        const { ok, violations } = lintSpec(a.code);
        if (!ok) return { textResultForLlm: `REJECTED — spec violates Playwright standards:\n${renderViolations(violations.filter((v) => !v.warn))}\nFix and resubmit.`, resultType: 'failure' };
        const dir = join(root, 'tests', 'authored');
        mkdirSync(dir, { recursive: true });
        const file = join(dir, `${slug(a.name)}.spec.ts`);
        writeFileSync(file, a.code);
        const warns = violations.filter((v) => v.warn);
        return `wrote ${file}${warns.length ? `\n(advisory:\n${renderViolations(warns)})` : ''} — now call run_spec to verify it.`;
      },
    }),
    tool('heal_locator', {
      description: 'Recover a DRIFTED locator after a run_spec failure: given the locator that no longer ' +
        'resolves on the CURRENT page (same shape as propose_locator: tier/role/name), attempt a gate-verified ' +
        'replacement. Returns a NEW locator flagged needs-confirmation, or refuses when recovery is ambiguous. ' +
        'It NEVER silently rewrites a test to pass — you must confirm the proposed element is the right one before using it.',
      parameters: {
        type: 'object',
        required: ['tier'],
        properties: {
          tier: { enum: ['role', 'label', 'placeholder', 'text', 'altText', 'title', 'testid', 'css', 'xpath'] },
          role: { type: 'string' }, name: { type: 'string' }, frame: { type: 'string' },
        },
      },
      skipPermission: true,
      handler: async (p) => {
        const { page } = await getCtx();
        const r = await healLocator(page, p);
        if (!r.healed) return { textResultForLlm: `NO HEAL: ${r.reason}`, resultType: 'failure' };
        return `HEAL CANDIDATE (confirm it is the right element before using):\n${r.locator}\n(was: ${r.was}; tier ${r.tier})`;
      },
    }),
    tool('write_pom', {
      description: 'Write a Page Object class under tests/authored/<name>.pom.ts — a class whose members are gate-ACCEPTED ' +
        'locators (role + name) and whose methods wrap actions/assertions, so a durable flow is reusable and reads at one ' +
        'altitude. Linted to the SAME Playwright standards as specs (no hard sleeps / networkidle / raw handles / XPath) and ' +
        'REJECTED if it violates them. Then import it from your spec and call run_spec.',
      parameters: { type: 'object', required: ['name', 'code'], properties: { name: { type: 'string' }, code: { type: 'string', description: 'full .pom.ts source (an exported class)' } } },
      handler: async (a) => {
        const { ok, violations } = lintSpec(a.code);
        if (!ok) return { textResultForLlm: `REJECTED — page object violates Playwright standards:\n${renderViolations(violations.filter((v) => !v.warn))}\nFix and resubmit.`, resultType: 'failure' };
        const dir = join(root, 'tests', 'authored');
        mkdirSync(dir, { recursive: true });
        const name = slug(a.name);
        const file = join(dir, `${name}.pom.ts`);
        writeFileSync(file, a.code);
        const warns = violations.filter((v) => v.warn);
        return `wrote ${file}${warns.length ? `\n(advisory:\n${renderViolations(warns)})` : ''} — import it from your spec: import { /* YourPage */ } from './${name}.pom'; then call run_spec.`;
      },
    }),
    tool('run_spec', {
      description: 'Run an authored spec (or all of tests/authored) through Playwright — the deterministic gate. Returns pass/fail and output.',
      parameters: { type: 'object', properties: { name: { type: 'string', description: 'spec name to run; omit to run all authored specs' } } },
      handler: async (a) => {
        const target = a?.name ? join('tests', 'authored', `${slug(a.name)}.spec.ts`) : join('tests', 'authored');
        return await new Promise<ToolResult>((resolve) => {
          execFile('npx', ['playwright', 'test', target, '--reporter=line'], { cwd: root, maxBuffer: 16 << 20, env: { ...process.env, RUN_AUTHORED: '1' } }, (err, stdout, stderr) => {
            const out = `${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim().slice(-4000);
            resolve(err ? { textResultForLlm: `FAILED:\n${out}`, resultType: 'failure' } : `PASSED:\n${out}`);
          });
        });
      },
    }),
  ];
}
