// Shared fixtures for AUTHORED specs the codifier writes. Importing `test` from here
// (instead of @playwright/test) gives a durable spec automatic login reuse: the
// storageState captured by save_auth is reused when present, and the test runs
// unauthenticated when it's absent — so a fresh checkout, the offline suite, and CI
// stay green without a captured login. Not a spec file (no test()) → never collected.
import { test as base, expect } from '@playwright/test';
import { resolveStorageState } from '../../src/authored.mjs';

// AUTH_STATE (or STORAGE_STATE, the var the codifier/save_auth use) points at the capture.
const AUTH = process.env.AUTH_STATE || process.env.STORAGE_STATE || '.auth/state.json';

export const test = base.extend({
  storageState: async ({}, use) => {
    await use(resolveStorageState(AUTH));
  },
});
export { expect };
