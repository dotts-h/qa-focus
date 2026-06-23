// The @playwright/cli action surface (src/pwcli.mts) — verifies the bin RESOLVES (the #0006
// publish-readiness fix: createRequire instead of a hardcoded ../node_modules hop) and that the
// driver attaches over CDP and snapshots a real page. Deterministic: a normal chromium with
// --remote-debugging-port stands in for any CDP surface (web/openfin); no model/quota.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { makePwCli } from '../src/pwcli.mjs';
import { openSurface } from '../src/provider.mjs';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error('no port'))));
    });
  });
}

// Attaching + snapshotting proves the bin RESOLVED (the #0006 createRequire fix) AND ran via node —
// if resolveCliBin() returned a wrong/missing path, attach would fail (ok:false) here.
test('pwcli resolves the @playwright/cli bin, attaches over CDP, and snapshots a real page', async () => {
  const surface = await openSurface({ kind: 'web', cdpPort: await freePort(), channel: process.env.PW_CHANNEL });
  try {
    await surface.page.setContent('<h1>Todo</h1><button>Add</button>');
    const pw = makePwCli({ session: 'qa-focus-pwcli-test' });
    const att = await pw.attach(surface.cdpEndpoint!);
    expect(att.ok).toBe(true);
    const snap = await pw.cmd('snapshot');
    expect(snap.ok).toBe(true);
    expect(snap.out.toLowerCase()).toContain('button');
    await pw.detach();
  } finally {
    await surface.close();
  }
});
