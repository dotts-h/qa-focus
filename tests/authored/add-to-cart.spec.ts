import { test, expect } from '@playwright/test';

test('add Blue Top to cart and verify quantity 1', async ({ page }) => {
  // Dismiss any consent/cookie banner (best-effort, tolerant)
  await page.goto('https://automationexercise.com/products');
  await page.getByRole('button', { name: /consent|accept|agree|allow/i }).first().click().catch(() => {});

  // Step 1: Search for "Blue Top"
  await page.getByRole('textbox', { name: 'Search Product' }).fill('Blue Top');
  await page.locator('button#submit_search').click();

  // Step 2: Open the product detail page
  await expect(page.getByRole('link', { name: 'View Product' })).toBeVisible();
  await page.getByRole('link', { name: 'View Product' }).click();

  // Step 3: Verify PDP and add to cart
  await expect(page.getByRole('heading', { name: 'Blue Top' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();

  // Step 4: Confirm modal and navigate to cart
  await expect(page.getByRole('link', { name: 'View Cart' })).toBeVisible();
  await page.getByRole('link', { name: 'View Cart' }).click();

  // Step 5: Assert Blue Top is in the cart with quantity 1
  await expect(page.getByRole('cell', { name: 'Blue Top Women > Tops' })).toBeVisible();
  const blueTopRow = page.locator('tr').filter({ hasText: 'Blue Top' });
  await expect(blueTopRow.getByRole('cell', { name: '1' })).toBeVisible();
});
