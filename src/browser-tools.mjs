// Shared browser-action tools — the model's capability surface for driving a page,
// used by BOTH the standalone explorer (bin/explore.mjs) and the interactive Copilot
// extension (extension/qa-focus/extension.mjs), so there is one implementation.
//
// Actions go through @playwright/cli (token-efficient [ref=eN] snapshots; ADR 0001).
// Verification routes through the in-process locator gate so a vague match is rejected
// rather than passing as a false positive. The factory takes the live `page` (gate +
// evidence), a `pwcli` driver attached to that same browser, and the allowlist.
//
// Returns descriptors shaped `{ name, def }` so each consumer can adapt them:
//   • harness:   makeBrowserTools(...).map(({name, def}) => defineTool(name, def))
//   • extension: makeBrowserTools(...).map(({name, def}) => ({ name, ...def }))
//
// `getCtx` is an async () => { page, pwcli } resolved PER CALL, so a consumer can
// open the browser lazily (the extension opens it on first tool use, after joinSession;
// the harness just returns its already-open page/pwcli).
import { expect } from '@playwright/test';
import { gradeLocator, buildLocator, render } from '../extension/qa-focus/ladder.mjs';
import { parseSnapshotRefs, recordStep } from './flow.mjs';

export function makeBrowserTools({ getCtx, allow = () => true, allowlist = [], sink, findings, saveState, statePath, flow }) {
  const step = (s) => sink?.steps?.push(s);
  const tool = (name, def) => ({ name, def });
  // The latest snapshot's ref→{role,name} map, so by-ref actions can be recorded as
  // DURABLE accessible steps in `flow` (the explorer→codifier handoff). Refs themselves
  // are ephemeral; the role+name behind them is what the codifier re-walks.
  let refMap = new Map();

  return [
    tool('browser_snapshot', {
      description: 'Capture the accessibility-tree snapshot of the current page. Returns roles + names + element refs (e.g. [ref=e5]); act on those refs with browser_click / browser_fill. Pass "depth" to trim large pages.',
      parameters: { type: 'object', properties: { depth: { type: 'integer', description: 'max tree depth to include' } } },
      skipPermission: true,
      handler: async (a) => {
        const { pwcli } = await getCtx();
        const r = await pwcli.cmd('snapshot', ...(a?.depth ? ['--depth', String(a.depth)] : []));
        step('snapshot');
        if (r.ok) refMap = parseSnapshotRefs(r.out); // refresh ref→accessible-name for durable step capture
        return r.ok ? r.out : { textResultForLlm: `snapshot failed: ${r.out}`, resultType: 'failure' };
      },
    }),
    tool('browser_goto', {
      description: 'Navigate to a URL (allowlisted hosts only).',
      parameters: { type: 'object', required: ['url'], properties: { url: { type: 'string' } } },
      skipPermission: true,
      handler: async (a) => {
        if (!allow(a.url)) return { textResultForLlm: `BLOCKED: ${a.url} is not on the allowlist (${allowlist.join(', ')}).`, resultType: 'denied' };
        const { pwcli } = await getCtx();
        const r = await pwcli.cmd('goto', a.url);
        step(`goto ${a.url}`);
        if (r.ok) recordStep(flow, { action: 'goto', url: a.url });
        return r.ok ? `at ${a.url}` : { textResultForLlm: `goto failed: ${r.out}`, resultType: 'failure' };
      },
    }),
    tool('browser_click', {
      description: 'Click an element by its ref (e.g. "e5") from the latest browser_snapshot.',
      parameters: { type: 'object', required: ['ref'], properties: { ref: { type: 'string' } } },
      skipPermission: true,
      handler: async (a) => {
        const { pwcli } = await getCtx();
        const r = await pwcli.cmd('click', a.ref);
        step(`click ${a.ref}`);
        if (r.ok) recordStep(flow, { action: 'click', ...(refMap.get(a.ref) || {}) });
        return r.ok ? 'clicked' : { textResultForLlm: `click failed: ${r.out}`, resultType: 'failure' };
      },
    }),
    tool('browser_fill', {
      description: 'Fill text into an editable element by its ref (from browser_snapshot). Set submit:true to press Enter after.',
      parameters: { type: 'object', required: ['ref', 'text'], properties: { ref: { type: 'string' }, text: { type: 'string' }, submit: { type: 'boolean' } } },
      skipPermission: true,
      handler: async (a) => {
        const { pwcli } = await getCtx();
        const r = await pwcli.cmd('fill', a.ref, a.text, ...(a.submit ? ['--submit'] : []));
        step(`fill ${a.ref} = "${a.text}"${a.submit ? ' +submit' : ''}`);
        if (r.ok) recordStep(flow, { action: 'fill', ...(refMap.get(a.ref) || {}), text: a.text, ...(a.submit ? { submit: true } : {}) });
        return r.ok ? 'filled' : { textResultForLlm: `fill failed: ${r.out}`, resultType: 'failure' };
      },
    }),
    tool('browser_press', {
      description: 'Press a keyboard key (e.g. "Enter", "ArrowDown").',
      parameters: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
      skipPermission: true,
      handler: async (a) => {
        const { pwcli } = await getCtx();
        const r = await pwcli.cmd('press', a.key);
        step(`press ${a.key}`);
        if (r.ok) recordStep(flow, { action: 'press', key: a.key });
        return r.ok ? 'pressed' : { textResultForLlm: `press failed: ${r.out}`, resultType: 'failure' };
      },
    }),
    tool('dismiss_consent', {
      description: 'Best-effort dismiss a cookie/consent/GDPR banner or modal that is blocking the page ' +
        '(clicks an Accept / Agree / Allow all / Got it control). Call this when an overlay seems to block the flow. ' +
        'Reports what it clicked, or that none was found. Re-snapshot afterwards.',
      parameters: { type: 'object', properties: {} },
      skipPermission: true,
      handler: async () => {
        const { page } = await getCtx();
        const patterns = [/^accept all/i, /^accept/i, /^i accept/i, /^agree/i, /^i agree/i, /^allow all/i, /^allow/i, /^got it/i, /^ok\b/i, /^continue/i, /consent/i];
        for (const re of patterns) {
          for (const role of ['button', 'link']) {
            const loc = page.getByRole(role, { name: re }).first();
            try {
              if ((await loc.count()) && (await loc.isVisible())) {
                await loc.click({ timeout: 2000 });
                step(`dismiss_consent: clicked ${role} matching ${re}`);
                return `dismissed consent via ${role} matching ${re}`;
              }
            } catch { /* try the next pattern */ }
          }
        }
        step('dismiss_consent: none found');
        return 'no consent banner found (page may have none, or it uses a non-standard control)';
      },
    }),
    tool('browser_expect_visible', {
      description: 'Verify a result is visible. Prefer an accessible role + name; for plain content (e.g. a new list-item label, which is NOT an element\'s accessible name) pass "text" instead. For an element inside an IFRAME, pass "frame" (a CSS selector for the <iframe>, e.g. iframe[title="Editor"]) — open shadow DOM needs nothing (Playwright pierces it). The locator is graded by the priority gate before asserting — a vague match (e.g. role "listitem" with no unique name, resolving to many) is REJECTED rather than passing as a false positive.',
      parameters: { type: 'object', properties: { role: { type: 'string' }, name: { type: 'string' }, text: { type: 'string', description: 'visible text to assert (uses getByText) when the target has no accessible role+name' }, frame: { type: 'string', description: 'CSS selector for the containing <iframe>, when the element lives inside one' } } },
      skipPermission: true,
      handler: async (a) => {
        if (!a.role && !a.text) return { textResultForLlm: 'provide either role (+name) or text', resultType: 'failure' };
        const { page } = await getCtx();
        const proposal = a.role
          ? { tier: 'role', role: a.role, ...(a.name ? { name: a.name } : {}), ...(a.frame ? { frame: a.frame } : {}) }
          : { tier: 'text', name: a.text, ...(a.frame ? { frame: a.frame } : {}) };
        const grade = await gradeLocator(page, proposal);
        if (!grade.ok) {
          step(`verify ${a.role || a.text} ✗ (gate: ${grade.reason})`);
          return { textResultForLlm: `VERIFY REJECTED by the locator gate: ${grade.reason}. Give a more specific role+name (or text) that resolves to exactly one element.`, resultType: 'failure' };
        }
        const loc = buildLocator(page, proposal);
        try {
          await expect(loc).toBeVisible({ timeout: 5000 });
          step(`verify ${render(proposal)} ✓`);
          recordStep(flow, a.role
            ? { action: 'expect', role: a.role, ...(a.name ? { name: a.name } : {}), ...(a.frame ? { frame: a.frame } : {}) }
            : { action: 'expect', text: a.text, ...(a.frame ? { frame: a.frame } : {}) });
          return `verified visible: ${render(proposal)}`;
        } catch {
          step(`verify ${render(proposal)} ✗ (not visible)`);
          return { textResultForLlm: 'gate accepted the locator but the element is NOT visible within 5s', resultType: 'failure' };
        }
      },
    }),
    ...(saveState ? [tool('save_auth', {
      description: 'Capture the current login (cookies + localStorage) to a storageState file so authenticated ' +
        'flows can be replayed without logging in again. Call this AFTER you have successfully logged in.',
      parameters: { type: 'object', properties: {} },
      skipPermission: true,
      handler: async () => {
        try { await saveState(statePath); step(`saved auth → ${statePath}`); return `saved login storageState to ${statePath}`; }
        catch (e) { return { textResultForLlm: `save_auth failed: ${e?.message || e}`, resultType: 'failure' }; }
      },
    })] : []),
    tool('report_finding', {
      description: 'Record a bug/usability finding for human verification.',
      parameters: { type: 'object', required: ['title'], properties: { severity: { enum: ['high', 'medium', 'low'] }, title: { type: 'string' }, detail: { type: 'string' } } },
      skipPermission: true,
      handler: async (a) => { findings?.push(a); return 'recorded'; },
    }),
    tool('audit_a11y', {
      description: 'Run a DETERMINISTIC accessibility audit (axe-core / WCAG) on the current page. ' +
        'Records each violation as a finding (tool-verified, not model judgement) and returns a summary. ' +
        'Optionally pass "region" (a CSS selector) to scope the scan. Run it on each meaningful screen.',
      parameters: { type: 'object', properties: { region: { type: 'string', description: 'CSS selector to scope the audit to' } } },
      skipPermission: true,
      handler: async (a) => {
        const { page } = await getCtx();
        let AxeBuilder;
        try { ({ default: AxeBuilder } = await import('@axe-core/playwright')); }
        catch { return { textResultForLlm: 'a11y audit unavailable: @axe-core/playwright is not installed', resultType: 'failure' }; }
        let builder = new AxeBuilder({ page });
        if (a?.region) builder = builder.include(a.region);
        let results;
        try { results = await builder.analyze(); }
        catch (e) { return { textResultForLlm: `a11y audit failed: ${e?.message || e}`, resultType: 'failure' }; }
        // axe impact (critical/serious/moderate/minor) → our severity buckets.
        const sevOf = { critical: 'high', serious: 'high', moderate: 'medium', minor: 'low' };
        for (const v of results.violations) {
          const where = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('; ');
          findings?.push({
            severity: sevOf[v.impact] || 'low',
            title: `[a11y/${v.id}] ${v.help}`,
            detail: `${v.description} — ${v.nodes.length} node(s): ${where}${v.nodes.length > 3 ? ' …' : ''} (${v.helpUrl})`,
            source: 'axe',
          });
        }
        step(`a11y audit: ${results.violations.length} violation type(s)`);
        const summary = results.violations.map((v) => `${v.impact}:${v.id}×${v.nodes.length}`).join(', ') || 'no violations';
        return `axe recorded ${results.violations.length} violation type(s) as findings — ${summary}`;
      },
    }),
  ];
}
