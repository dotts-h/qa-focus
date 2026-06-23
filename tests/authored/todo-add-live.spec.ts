import { test, expect } from '@playwright/test';

test('Add a task called buy milk, then add walk dog, and verify both appear in the list', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Tolerant best-effort consent dismissal
  await page.getByRole('button', { name: /accept|agree|allow|got it/i }).click().catch(() => {});

  const input = page.getByRole('textbox', { name: 'New task' });
  const addBtn = page.getByRole('button', { name: 'Add' });
  const taskList = page.getByRole('list', { name: 'tasks' });

  await input.fill('buy milk');
  await addBtn.click();

  await input.fill('walk dog');
  await addBtn.click();

  await expect(taskList).toBeVisible();
  await expect(page.getByText('buy milk')).toBeVisible();
  await expect(page.getByText('walk dog')).toBeVisible();
});
