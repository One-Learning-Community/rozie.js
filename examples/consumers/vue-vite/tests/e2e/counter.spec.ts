// Phase 3 success criterion 1: Counter mounts and increment click updates value 0 → 1.
//
// The .rozie compiles to a Vue SFC with `defineModel('value')` two-way binding.
// The page wrapper (src/pages/Counter.vue) binds `v-model:value` to a parent ref.
// We click "Increment" (aria-label) and assert the displayed `.value` element
// flips from "0" to "1".
import { test, expect } from '@playwright/test';

test('Counter increments value via click (success criterion 1 / VUE-01..04)', async ({ page }) => {
  await page.goto('/');
  // Counter is the default page; click the nav button to be explicit.
  await page.getByRole('button', { name: 'Counter', exact: true }).click();

  // The Counter component renders a `.value` span with the current value.
  await expect(page.locator('.value')).toHaveText('0');

  // Click the Increment button (aria-label="Increment" inside Counter.rozie).
  await page.getByRole('button', { name: 'Increment' }).click();
  await expect(page.locator('.value')).toHaveText('1');

  // Click decrement → back to 0.
  await page.getByRole('button', { name: 'Decrement' }).click();
  await expect(page.locator('.value')).toHaveText('0');
});
