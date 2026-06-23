import { test, expect, _electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  electronApp = await _electron.launch({
    args: [process.env.QA_ELECTRON_APP ?? 'fixtures/electron', '--no-sandbox'],
  });
  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp?.close();
});

test('Todo heading is visible', async () => {
  await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
});

test('New task textbox is visible and accepts input', async () => {
  await expect(page.getByRole('textbox', { name: 'New task' })).toBeVisible();
  await page.getByRole('textbox', { name: 'New task' }).fill('Test task entry');
});

test('Add button is visible', async () => {
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
});
