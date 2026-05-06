// Phase 5 Plan 05-02b — Modal spec.
//
// Modal.rozie demonstrates:
//   - $bindable for `open` (model: true)
//   - <listeners> with keydown.escape ($effect with addEventListener cleanup)
//   - r-if (full unmount) — modal isn't in tree when closed
//   - $emit('close') → parent receives `onclose` callback prop
//   - :root { --rozie-modal-z: 2000 } — wraps as :global(:root) in Svelte
//
// SVELTE-05 anchor: CSS variable :root escape hatch survives Svelte
// scoping (verified via getComputedStyle on the root element).
import { test, expect } from '@playwright/test';

test('Modal opens via prop binding + closes via × button (SVELTE-05 — $bindable + r-if)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-modal').click();

  // Initially closed — modal is unmounted (r-if).
  await expect(page.locator('[role="dialog"]')).toBeHidden();

  // Open via prop binding — App.svelte sets modalOpen = true.
  await page.getByTestId('open-modal').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Close via the × button (Modal.rozie close() handler — sets $props.open=false; emits 'close').
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('[role="dialog"]')).toBeHidden();

  // The onclose emit reached App.svelte → close-count text appears.
  await expect(page.getByTestId('modal-close-count')).toBeVisible();
  await expect(page.getByTestId('modal-close-count')).toHaveText('Closed 1 time(s)');
});

test('Modal :root CSS variable --rozie-modal-z is accessible globally (SVELTE-05 — :global(:root) escape hatch)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-modal').click();
  await page.getByTestId('open-modal').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // The :root rule in Modal.rozie's <style> wraps as :global(:root) {
  //   --rozie-modal-z: 2000;
  // } per the Svelte emitter. getComputedStyle(document.documentElement)
  // should expose it.
  const z = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--rozie-modal-z').trim(),
  );
  expect(z).toBe('2000');
});

test('Modal closes on Escape key (SVELTE-02-style listener)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-modal').click();
  await page.getByTestId('open-modal').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).toBeHidden();
});
