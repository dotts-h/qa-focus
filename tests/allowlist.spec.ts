// Deterministic proof of the explorer's primary safety control — no browser.
import { test, expect } from '@playwright/test';
import { makeAllowlist } from '../src/allowlist.mjs';

test.describe('URL allowlist', () => {
  const allow = makeAllowlist(['localhost', 'staging.acme.com']);

  test('allows exact host and subdomains', () => {
    expect(allow('http://localhost:3000/login')).toBe(true);
    expect(allow('https://staging.acme.com/app')).toBe(true);
    expect(allow('https://www.staging.acme.com/x')).toBe(true);
  });

  test('blocks untrusted hosts and lookalikes', () => {
    expect(allow('https://evil.com/x')).toBe(false);
    expect(allow('https://staging.acme.com.evil.com/x')).toBe(false);
    expect(allow('https://acme.com/x')).toBe(false);
  });

  test('blocks non-http schemes (file:, data:, about:)', () => {
    expect(allow('file:///etc/passwd')).toBe(false);
    expect(allow('data:text/html,<h1>x')).toBe(false);
    expect(allow('about:blank')).toBe(false);
    expect(allow('not a url')).toBe(false);
  });
});
