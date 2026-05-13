// Phase 06.4 Plan 03 — Dropdown outside-click via composedPath() in a real
// browser. Verifies the shadow-DOM-aware attachOutsideClickListener helper
// correctly detects clicks that originate outside the dropdown's composed
// tree (where contains() would have falsely matched the trigger element).
import { test, expect } from '@playwright/test';

test('Dropdown opens via trigger and closes on outside click', async ({ page }) => {
  await page.goto('/src/pages/DropdownPage.html');
  const dropdown = page.locator('#dropdown');
  const openState = page.locator('#open-state');

  // Initial closed state.
  await expect(openState).toHaveText('false');

  // Click the slotted trigger button — this is light-DOM (slotted content
  // lives outside the shadow root), so a normal click works.
  await page.locator('#trigger-btn').click();

  // The Dropdown.rozie wires the slot trigger's click via a host listener.
  // Wait for the state to flip to open.
  await expect(openState).toHaveText('true');

  // Click the outside button — the outside-click listener uses
  // composedPath() to detect this is NOT within the dropdown's composed
  // tree, so the dropdown closes.
  await page.locator('#outside').click();
  await expect(openState).toHaveText('false');
});
