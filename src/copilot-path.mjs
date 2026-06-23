// Resolve the installed GitHub Copilot CLI path portably.
//
// The standalone harness spawns `copilot` via RuntimeConnection.forStdio({ path }),
// and the SDK validates that the path EXISTS — so a hardcoded default breaks the
// moment the binary lives elsewhere (e.g. Homebrew's /opt/homebrew/bin on the Mac
// mini vs /usr/local/bin on the Linux brain). Prefer $COPILOT_CLI, then PATH, then
// the well-known install locations.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export function resolveCopilotCli() {
  if (process.env.COPILOT_CLI) return process.env.COPILOT_CLI;
  try {
    const p = execFileSync('sh', ['-c', 'command -v copilot'], { encoding: 'utf8' }).trim();
    if (p && existsSync(p)) return p;
  } catch { /* not on PATH */ }
  for (const p of ['/opt/homebrew/bin/copilot', '/usr/local/bin/copilot']) if (existsSync(p)) return p;
  return 'copilot'; // last resort — let the spawn resolve via PATH
}
