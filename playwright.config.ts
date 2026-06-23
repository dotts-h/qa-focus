import { defineConfig, devices } from '@playwright/test';

// Timeouts live here, never as hard sleeps in tests.
export default defineConfig({
  testDir: './tests',
  // Authored specs (tests/authored/) are durable tests the CODIFIER writes for a TARGET
  // app — they hit the network and must NOT run in the deterministic offline suite.
  // run_spec sets RUN_AUTHORED=1 to include them when it runs an authored spec by name.
  testIgnore: process.env.RUN_AUTHORED ? [] : ['**/authored/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  // channel undefined → Playwright's bundled Chromium (no branded Chrome needed).
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL } }],
  webServer: {
    command: 'node ./fixtures/app/server.mjs',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
