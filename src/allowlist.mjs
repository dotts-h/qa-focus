// URL allowlist — the explorer's primary safety control. Autonomous browsing of
// untrusted pages risks prompt injection (hidden DOM text telling the agent to
// exfiltrate secrets). The allowlist restricts navigation to trusted hosts; the
// stronger, complementary defense is tool-gating (the explorer holds no
// filesystem/shell/network tools — see bin/explore.mjs).

/** Build an allow predicate from host patterns (e.g. ['localhost', 'staging.acme.com']). */
export function makeAllowlist(patterns = []) {
  const allow = patterns.map((p) => String(p).trim()).filter(Boolean);
  return (url) => {
    let u;
    try { u = new URL(url); } catch { return false; }
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    return allow.some((p) => u.hostname === p || u.host === p || u.hostname.endsWith('.' + p) || url.startsWith(p));
  };
}

/** Abort top-level navigations to disallowed documents at the network layer. */
export async function guardContext(context, allow) {
  await context.route('**/*', (route) => {
    const req = route.request();
    if (req.resourceType() === 'document' && req.isNavigationRequest() && !allow(req.url())) {
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
}
