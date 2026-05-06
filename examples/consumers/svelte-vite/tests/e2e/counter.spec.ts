// Phase 5 Plan 05-02b — Counter spec.
//
// Counter.rozie compiles to a Svelte 5 SFC with:
//   - $bindable(0) for `value` (model: true prop)
//   - $state(false) for `hovering` ($data declaration)
//   - $derived for canIncrement / canDecrement
//   - onclick={...} arrow handlers (NO on:click — Pitfall 4)
//
// App.svelte binds `bind:value={counterValue}` so the parent counter mirror
// reflects each click. We click +/- buttons and assert both the inner
// `.value` span AND the parent-tracked `data-testid="parent-value"` span
// flip together (proves $bindable two-way binding works end-to-end).
import { test, expect } from '@playwright/test';

test('Counter renders and increments via click (SVELTE-01 / SVELTE-04 — $bindable + $derived)', async ({ page }) => {
  await page.goto('/');
  // Counter is the default page; click the nav button to be explicit.
  await page.getByTestId('nav-counter').click();

  // The Counter component renders a `.value` span with the current value.
  await expect(page.locator('.value')).toHaveText('0');
  await expect(page.getByTestId('parent-value')).toHaveText('0');

  // Click the Increment button (aria-label="Increment" inside Counter.rozie).
  await page.getByRole('button', { name: 'Increment' }).click();
  await expect(page.locator('.value')).toHaveText('1');
  await expect(page.getByTestId('parent-value')).toHaveText('1');

  // Click decrement → back to 0.
  await page.getByRole('button', { name: 'Decrement' }).click();
  await expect(page.locator('.value')).toHaveText('0');
  await expect(page.getByTestId('parent-value')).toHaveText('0');
});
