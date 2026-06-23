// Helpers for the DURABLE authored layer (the codifier's output, used on real apps).
//
// Two production needs the research flagged: (1) reuse a captured login (storageState)
// so an authenticated flow doesn't re-login every run, and (2) structure flows as page
// objects. This module owns the auth-reuse decision so it's one pure, testable rule; the
// POM structure is enforced by the standards linter (shared with specs) at write_pom time.
import { existsSync } from 'node:fs';

/**
 * Decide the storageState for an authored test. Reuse the captured login ONLY when the
 * file actually exists: Playwright throws on a missing storageState path, and the offline
 * suite / a fresh checkout have no capture — so we must fall back to an unauthenticated
 * context (return undefined) rather than crash. `exists` is injectable for tests.
 */
export function resolveStorageState(
  authPath: string | undefined,
  exists: (p: string) => boolean = existsSync,
): string | undefined {
  return authPath && exists(authPath) ? authPath : undefined;
}
