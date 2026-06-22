// Evidence collection → human-readable Markdown artifact. Mirrors Antigravity's
// "artifact" idea on plain Playwright: console errors, failed/5xx requests,
// screenshots, and a trace are gathered while the agent works, then synthesized
// so a human can verify any reported finding (findings are reported, never
// self-certified).

export function newSink() {
  return { steps: [], console: [], network: [], shots: [] };
}

export function attachCollectors(page, sink) {
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) sink.console.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('requestfailed', (r) => sink.network.push(`FAILED ${r.request().method()} ${r.url()} — ${r.failure()?.errorText ?? ''}`));
  page.on('response', (r) => { if (r.status() >= 500) sink.network.push(`HTTP ${r.status()} ${r.url()}`); });
}

export function renderArtifact({ goal, sink, findings = [], tracePath }) {
  const L = ['# QA Explore artifact', '', `**Goal:** ${goal}`, ''];
  L.push('## Steps', ...(sink.steps.length ? sink.steps.map((s, i) => `${i + 1}. ${s}`) : ['_none_']), '');
  if (findings.length) {
    L.push('## Findings (human-verify — not self-certified)');
    for (const f of findings) L.push(`- **[${f.severity || '?'}]** ${f.title}${f.detail ? ` — ${f.detail}` : ''}`);
    L.push('');
  }
  if (sink.console.length) L.push('## Console', '```', ...sink.console.slice(0, 50), '```', '');
  if (sink.network.length) L.push('## Network anomalies', '```', ...sink.network.slice(0, 50), '```', '');
  if (sink.shots.length) L.push('## Screenshots', ...sink.shots.map((s) => `- ${s}`), '');
  if (tracePath) L.push('## Trace', `\`npx playwright show-trace ${tracePath}\``, '');
  return L.join('\n');
}
