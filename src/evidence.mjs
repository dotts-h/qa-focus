// Evidence collection → human-readable Markdown artifact. Mirrors Antigravity's
// "artifact" idea on plain Playwright: console errors, failed/5xx requests,
// screenshots, and a trace are gathered while the agent works, then synthesized
// so a human can verify any reported finding (findings are reported, never
// self-certified).

export function newSink() {
  return { steps: [], console: [], network: [], shots: [], thirdPartyBlocked: 0 };
}

// `allow(url)` (the navigation allowlist predicate) doubles as the first-party test:
// a real big site fires a flood of third-party ad/tracker requests that the browser
// blocks client-side (net::ERR_BLOCKED_BY_CLIENT) — those are not defects in the app
// under test and would bury the real signal. We keep a failure only when it's
// first-party OR a mixed-content error (a page misconfiguration regardless of host,
// e.g. an http:// font referenced from an https page); everything else is counted, not listed.
export function attachCollectors(page, sink, allow = () => true) {
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) sink.console.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('requestfailed', (r) => {
    const url = r.url();
    const err = r.failure()?.errorText ?? '';
    if (!allow(url) && !/mixed-content/i.test(err)) { sink.thirdPartyBlocked++; return; }
    sink.network.push(`FAILED ${r.method()} ${url} — ${err}`);
  });
  page.on('response', (r) => { if (r.status() >= 500 && allow(r.url())) sink.network.push(`HTTP ${r.status()} ${r.url()}`); });
}

export function renderArtifact({ goal, sink, findings = [], tracePath }) {
  const L = ['# QA Explore artifact', '', `**Goal:** ${goal}`, ''];
  L.push('## Steps', ...(sink.steps.length ? sink.steps.map((s, i) => `${i + 1}. ${s}`) : ['_none_']), '');
  if (findings.length) {
    L.push('## Findings (human-verify — not self-certified)');
    for (const f of findings) L.push(`- **[${f.severity || '?'}]** ${f.title}${f.detail ? ` — ${f.detail}` : ''}`);
    L.push('');
  }
  if (sink.console.length) L.push('## Console', '```', ...[...new Set(sink.console)].slice(0, 50), '```', '');
  if (sink.network.length) L.push('## Network anomalies', '```', ...[...new Set(sink.network)].slice(0, 50), '```', '');
  if (sink.thirdPartyBlocked) L.push(`_(+${sink.thirdPartyBlocked} third-party requests blocked client-side — not app defects, omitted)_`, '');
  if (sink.shots.length) L.push('## Screenshots', ...sink.shots.map((s) => `- ${s}`), '');
  if (tracePath) L.push('## Trace', `\`npx playwright show-trace ${tracePath}\``, '');
  return L.join('\n');
}
