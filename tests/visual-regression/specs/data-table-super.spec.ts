import { test, expect } from '@playwright/test';

test('super demo renders a table in Vue', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await expect(page.getByTestId('dt-super')).toBeVisible();
  await expect(page.locator('table, [role="grid"], [role="table"]')).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});
