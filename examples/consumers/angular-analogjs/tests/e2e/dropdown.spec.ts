// Phase 5 Plan 05-04b — Dropdown spec.
//
// Dropdown.rozie has a <listeners> block:
//   "document:click.outside($refs.triggerEl, $refs.panelEl)": {
//     when: "$props.open && $props.closeOnOutsideClick",
//     handler: close,
//   }
//
// Per Plan 05-04a, the Angular emitter wires this as an `effect((onCleanup) => {...})`
// block in the constructor body using `Renderer2.listen('document', 'click', handler)`
// + `onCleanup(unlisten)` for DestroyRef-tracked cleanup. The .outside collapses
// to an inline contains-check on the typed viewChild()` ref signals — no
// @rozie/runtime-angular helper.
//
// REQ ANGULAR-02 — Renderer2.listen + DestroyRef cleanup.
import { test, expect } from '@playwright/test';

test('Dropdown outside-click closes when click is outside both refs (ANGULAR-02 — .outside parity)', async ({ page }) => {
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

test('Dropdown closes on Escape key (ANGULAR-02 — keydown.escape listener)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-dropdown').click();

  await page.getByTestId('dropdown-trigger').click();
  await expect(page.locator('.dropdown-panel')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.dropdown-panel')).toBeHidden();
});
