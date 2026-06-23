// Deterministic Playwright-standards linter for AUTHORED specs — the codifier's
// non-negotiable rules, enforced as code (not just prompt text). Encodes the
// research-backed checklist for stable tests on complex (Angular/iframe/shadow) apps:
// web-first assertions, no hard waits, no networkidle, no raw element handles, and
// no XPath (it does NOT pierce shadow DOM). The locator-priority gate (ladder.mts)
// covers locator quality; this covers the surrounding test code.
//
// lintSpec(source) → { ok, violations: [{ rule, line, snippet, why }] }.

/** The always-on standards prompt, re-injected each turn (shared by the extension + REPL). */
export const STANDARDS_PROMPT =
  'PLAYWRIGHT STANDARDS (always on):\n' +
  '• LOCATOR LADDER: role > label > placeholder > text > altText > title > testid > scoped (accessible parent + child) > css/xpath. ' +
  'Never hand-write CSS/XPath when an accessible locator works; disambiguate non-unique names by scoping to an accessible ancestor BEFORE css.\n' +
  '• STABILITY: web-first assertions only (expect(locator).toBeVisible()/toHaveText() auto-retry). NO hard sleeps (waitForTimeout), ' +
  'NO networkidle (flaky on SPAs/Angular — it polls constantly). The codifier rejects these.\n' +
  '• IFRAMES: page.getByRole does NOT pierce iframes — for in-frame elements pass `frame` (an <iframe> CSS selector) to ' +
  'browser_expect_visible / propose_locator; it renders page.frameLocator(...).…. Actions (click/fill) work directly on frame refs (fNeM) from the snapshot.\n' +
  '• SHADOW DOM: OPEN roots are pierced automatically (just use role+name). XPath does NOT pierce shadow DOM. CLOSED roots are invisible ' +
  'unless the surface was opened with FORCE_OPEN_SHADOW=1.\n' +
  '• ANGULAR: Material exposes ARIA roles (combobox/menuitem/dialog). mat-select/mat-dialog/tooltip render in .cdk-overlay-container at <body> ' +
  '(not under the trigger) — find them at the document level. Virtual-scroll lists only render visible rows — scroll the viewport to reveal more.\n' +
  '• STRUCTURE: for a reusable flow, author a Page Object with write_pom (a class wrapping gate-accepted locators + actions), ' +
  'then a thin spec that imports it. For an AUTHENTICATED app, log in once and call save_auth, then import { test, expect } ' +
  "from './fixtures' in the spec so the captured storageState is reused — never script the login inside every test.\n" +
  '• FLOW: drive with browser_* (act on refs from browser_snapshot); harden with propose_locator → (write_pom?) → write_spec → run_spec.';

/**
 * The surface-aware "shape" instruction for `write_spec` — the durable test must EXECUTE on the
 * surface the flow was discovered on (#0027, ADR 0011). For web/openfin that is a URL-navigated
 * `{ page }` spec; for Electron there is no URL — the spec must launch the app itself with
 * `_electron.launch` (Electron exposes no CDP endpoint for the test fixture to attach to). The
 * gate-accepted locator expressions are rendered as `page.…`, so the Electron template binds the
 * launched window to a `page` variable — the accepted expressions are then reused verbatim. The
 * app path comes from `QA_ELECTRON_APP` (allowlisted through `safeSpecEnv`) so the spec is portable,
 * falling back to the path the codifier was launched with.
 */
export function specShapeInstruction(surface: string = 'web', { appPath = 'fixtures/electron' }: { appPath?: string } = {}): string {
  if (surface === 'electron') {
    return (
      'Call write_spec with the FULL .spec.ts source for an ELECTRON-EXECUTING test (this surface has ' +
      'no URL — DO NOT use page.goto):\n' +
      "  • import { test, expect, _electron } from '@playwright/test'; import type { ElectronApplication, Page } from 'playwright';\n" +
      '  • In test.beforeAll: const electronApp = await _electron.launch({ args: [process.env.QA_ELECTRON_APP ?? ' +
      `'${appPath}', '--no-sandbox'] }); const page = await electronApp.firstWindow();\n` +
      '  • In test.afterAll: await electronApp?.close();\n' +
      '  • Bind the first window to a variable named `page` so the gate-accepted page.getByRole(...) ' +
      'expressions are reused VERBATIM. Web-first assertions only (await expect(page.getByRole(...)).toBeVisible()), ' +
      'NO hard waits, NO networkidle, NO raw element handles, NO XPath.'
    );
  }
  return (
    'Call write_spec with the FULL .spec.ts source: a single test(), import { test, expect } from "@playwright/test", ' +
    'navigate by full URL (await page.goto(...)), web-first assertions only (await expect(locator).toBeVisible()), NO hard waits, ' +
    'NO networkidle, NO raw element handles, NO XPath. Reuse the gate-accepted locator expressions verbatim.'
  );
}

interface Rule {
  rule: string;
  re: RegExp;
  why: string;
  warn?: boolean;
}

const RULES: Rule[] = [
  {
    rule: 'no-hard-sleep',
    re: /\bwaitForTimeout\s*\(/,
    why: 'hard sleeps are flaky and slow — use a web-first assertion (expect(locator).toBeVisible() etc.) which auto-retries.',
  },
  {
    rule: 'no-networkidle',
    re: /networkidle/,
    why: "networkidle is unreliable on SPAs/Angular (constant polling/XHR) — wait on a visible-state assertion instead.",
  },
  {
    rule: 'no-raw-element-handle',
    re: /\bpage\.\$\$?\s*\(/,
    why: 'page.$ / page.$$ return static handles with no auto-waiting — use locators (getByRole/getByText/locator()).',
  },
  {
    rule: 'no-xpath',
    re: /(xpath=)|locator\(\s*['"`]\s*\/\//,
    why: 'XPath does NOT pierce shadow DOM and is brittle — use accessible locators; if truly unavoidable, document why in the test.',
  },
  {
    rule: 'no-waitForSelector',
    re: /\bwaitForSelector\s*\(/,
    why: 'waitForSelector is superseded by auto-waiting locators + web-first assertions.',
    warn: true, // advisory, not a hard failure
  },
];

/** A single standards violation found in authored spec source. */
export interface Violation {
  rule: string;
  line: number;
  snippet: string;
  why: string;
  warn: boolean;
}

/** The linter verdict: `ok` is false when any non-advisory rule fired. */
export interface LintResult {
  ok: boolean;
  violations: Violation[];
}

/** Lint authored Playwright spec source. Hard violations fail; `warn` rules are advisory. */
export function lintSpec(source: string = ''): LintResult {
  const lines = source.split('\n');
  const violations: Violation[] = [];
  lines.forEach((text, i) => {
    // Blank out comment-ONLY lines so guidance comments don't trip the rules. We do NOT
    // strip trailing `//` comments, because that would also erase `//` inside an XPath
    // string literal (e.g. locator('//button')) — the exact thing the no-xpath rule detects.
    const code = /^\s*\/\//.test(text) ? '' : text;
    for (const r of RULES) {
      if (r.re.test(code)) {
        violations.push({ rule: r.rule, line: i + 1, snippet: text.trim().slice(0, 120), why: r.why, warn: !!r.warn });
      }
    }
  });
  return { ok: !violations.some((v) => !v.warn), violations };
}

/** Render violations as a compact message for the model. */
export function renderViolations(violations: Violation[]): string {
  return violations
    .map((v) => `${v.warn ? 'WARN' : 'BLOCK'} [${v.rule}] line ${v.line}: ${v.snippet}\n   → ${v.why}`)
    .join('\n');
}
