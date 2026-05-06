// Phase 5 Plan 05-02b — Dropdown spec.
//
// Dropdown.rozie has a <listeners> block:
//   "document:click.outside($refs.triggerEl, $refs.panelEl)": {
//     when: "$props.open && $props.closeOnOutsideClick",
//     handler: close,
//   }
//
// Per RESEARCH.md A8/A9 RESOLVED, the Svelte emitter inlines the
// outsideClick logic as a contains-check inside an $effect — no
// @rozie/runtime-svelte helper. The Playwright spec opens the dropdown via
// the trigger slot button, asserts the panel is visible, clicks INSIDE the
// panel (should stay open), then clicks OUTSIDE both refs (should close).
//
// SVELTE-02 anchor: $effect with addEventListener + cleanup return; .outside
// modifier parity verified end-to-end.
import { test, expect } from '@playwright/test';

test('Dropdown outside-click closes when click is outside both refs (SVELTE-02 — .outside parity)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-dropdown').click();

  // Open the dropdown via the trigger slot button.
  await page.getByTestId('dropdown-trigger').click();
  await expect(page.locator('.dropdown-panel')).toBeVisible();
  await expect(page.getByTestId('dropdown-open-state')).toHaveText('true');

  // Click INSIDE the panel — dropdown should stay open (.outside refs include panelEl).
  await page.getByTestId('dropdown-items').click();
  await expect(page.locator('.dropdown-panel')).toBeVisible();

  // Click OUTSIDE both refs (top-left corner of body) — dropdown should close.
  await page.mouse.click(5, 5);
  await expect(page.locator('.dropdown-panel')).toBeHidden();
  await expect(page.getByTestId('dropdown-open-state')).toHaveText('false');
});

test('Dropdown closes on Escape key (SVELTE-02 — keydown.escape listener)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-dropdown').click();

  await page.getByTestId('dropdown-trigger').click();
  await expect(page.locator('.dropdown-panel')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.dropdown-panel')).toBeHidden();
});
