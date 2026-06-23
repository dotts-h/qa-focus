import { test, expect } from '@playwright/test';

test('Add a task called buy milk, then add walk dog, and verify both appear in the list.', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.getByRole('textbox', { name: 'New task' }).fill('buy milk');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('textbox', { name: 'New task' }).fill('walk dog');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('list', { name: 'tasks' })).toBeVisible();
  await expect(page.getByText('buy milk')).toBeVisible();
  await expect(page.getByText('walk dog')).toBeVisible();
});
