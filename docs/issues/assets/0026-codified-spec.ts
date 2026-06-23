import { test, expect } from '@playwright/test';

test('Electron Todo app loads: heading visible, input fillable, Add button present', async ({ page }) => {
  await page.goto('http://localhost:3000');

  await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();

  await page.getByRole('textbox', { name: 'New task' }).fill('Buy groceries');

  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
});
