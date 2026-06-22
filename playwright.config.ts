import { defineConfig, devices } from '@playwright/test';

// Timeouts live here, never as hard sleeps in tests.
export default defineConfig({
  testDir: './tests',
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
