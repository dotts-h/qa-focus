// Purpose-built DOM snapshot store (#0020, ADR 0009). The trace-driven healer
// (src/healer.mts) recovers a broken locator from the page's DOM as it was BEFORE the
// failure — captured while the locator still resolved. Rather than reverse-engineer
// Playwright's internal trace-snapshot encoding (nested arrays + [n,m] back-refs;
// undocumented, version-fragile), the explorer persists each pre-action DOM here as
// loadable HTML via the authoritative in-process gate page. The healer loads one back
// into a throwaway page and re-grades on the LIVE page (which stays authoritative).
import type { Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SnapshotStore {
  /** The directory snapshots are written to (created lazily on first capture). */
  readonly dir: string;
  /** Persist the page's current DOM as loadable HTML; returns the file path, or null on failure. */
  capture(page: Page, label?: string): Promise<string | null>;
  /** The most recent snapshot path, or null if none has been captured yet. */
  latest(): string | null;
}

const slugify = (s: string): string =>
  s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'step';

/** Create a snapshot store rooted at `dir`. Capture never throws — a failed snapshot
 *  must not break the run; it just returns null (the heal path tolerates a missing snapshot). */
export function createSnapshotStore(dir: string): SnapshotStore {
  let n = 0;
  let last: string | null = null;
  return {
    dir,
    latest: () => last,
    async capture(page, label) {
      try {
        const html = await page.content();
        mkdirSync(dir, { recursive: true });
        const file = join(dir, `${String(++n).padStart(4, '0')}-${slugify(label ?? 'step')}.html`);
        writeFileSync(file, html);
        last = file;
        return file;
      } catch {
        return null;
      }
    },
  };
}
