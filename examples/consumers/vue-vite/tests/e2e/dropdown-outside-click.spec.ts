// Phase 3 success criterion 2: Dropdown outside-click closes only when both refs
// are NOT clicked AND the `when:` predicate is truthy.
//
// Dropdown.rozie has a <listeners> block:
//   "document:click.outside($refs.triggerEl, $refs.panelEl)": {
//     when: "$props.open && $props.closeOnOutsideClick",
//     handler: close,
//   }
//
// Per D-42, this lowers to:
//   useOutsideClick([triggerEl, panelEl], () => close(), () => props.open && props.closeOnOutsideClick)
//
// The Playwright spec mounts the Dropdown via the demo page wrapper, opens it,
// confirms the panel is visible, clicks INSIDE the panel (should stay open),
// then clicks OUTSIDE both refs (should close).
import { test, expect } from '@playwright/test';

test('Dropdown outside-click closes when click is outside both refs AND when:predicate truthy (success criterion 2 / MOD-04 / VUE-03)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dropdown', exact: true }).click();

  // Open the dropdown via the trigger slot button.
  await page.getByRole('button', { name: 'Toggle Dropdown' }).click();
  await expect(page.locator('.dropdown-panel')).toBeVisible();

  // Click INSIDE the panel — dropdown should stay open (.outside refs include panelEl).
  await page.locator('.dropdown-panel').click();
  await expect(page.locator('.dropdown-panel')).toBeVisible();

  // Click on the panel's child element too — should still stay open.
  await page.locator('.dropdown-panel .dropdown-items').click();
  await expect(page.locator('.dropdown-panel')).toBeVisible();

  // Click OUTSIDE both refs (top-left corner of body) — dropdown should close.
  await page.mouse.click(5, 5);
  await expect(page.locator('.dropdown-panel')).toBeHidden();
});
