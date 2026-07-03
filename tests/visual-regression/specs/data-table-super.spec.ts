import { test, expect } from '@playwright/test';

test('super demo renders a table in Vue', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await expect(page.getByTestId('dt-super')).toBeVisible();
  await expect(page.locator('table, [role="grid"], [role="table"]')).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('header click updates the sorting readout', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // The columnheader <th> also hosts the per-column filter input, pin controls, and
  // resize handle stacked below the sort button (no flex layout) — clicking the <th>'s
  // center can land on a sibling control. Target the sort toggle button directly (its
  // accessible name is the exact column label; pin/resize buttons' names always carry
  // extra words like "Pin Customer to left", so `exact: true` disambiguates).
  await page.getByRole('button', { name: 'Customer', exact: true }).click();
  await expect(page.getByTestId('readout').locator('[data-slice="sorting"]')).toContainText('customer');
});

test('grid mode exposes role=grid', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByTestId('ctl-gridMode').selectOption('grid');
  await expect(page.locator('[role="grid"]')).toBeVisible();
});

test('virtualization windows the rows', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByTestId('ctl-virtual').check();
  await expect.poll(async () => page.locator('tbody tr').count()).toBeLessThan(100);
});
