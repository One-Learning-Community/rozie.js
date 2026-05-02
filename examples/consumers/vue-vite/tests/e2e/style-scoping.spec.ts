// Phase 3 success criterion 5 / VUE-05: `:root { }` blocks emit globally;
// other rules stay in `<style scoped>`.
//
// Dropdown.rozie has:
//   <style>
//     .dropdown { ... }            → emitted in `<style scoped>`
//     .dropdown-panel { ... }      → emitted in `<style scoped>`
//     :root { --rozie-dropdown-z: 1000; }  → emitted in a SECOND, GLOBAL `<style>` block
//   </style>
//
// Phase 3's snapshot-suite.test.ts already verified the SFC text shows two
// `<style>` blocks. Here we verify the runtime side: the global :root block
// installs `--rozie-dropdown-z` on document.documentElement (where it's
// reachable from any other component), AND the scoped `.dropdown-panel` class
// does NOT leak to elements outside the Dropdown component.
import { test, expect } from '@playwright/test';

test('Dropdown :root variables apply globally; scoped rules do not leak (success criterion 5 / VUE-05)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dropdown', exact: true }).click();

  // Open the dropdown so the panel renders + scoped styles apply.
  await page.getByRole('button', { name: 'Toggle Dropdown' }).click();
  await expect(page.locator('.dropdown-panel')).toBeVisible();

  // Global :root variable is reachable from document.documentElement.
  const rootZ = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--rozie-dropdown-z').trim(),
  );
  expect(rootZ).toBe('1000');

  // Scoped rules should NOT leak: a fresh element added to document.body
  // outside the Dropdown component should not pick up `.dropdown-panel`'s
  // scoped style attribute. We add an element with class `dropdown-panel`
  // and verify it does NOT match the scoped panel's z-index value.
  const leak = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'dropdown-panel';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    // Scoped block sets `position: fixed` on `.dropdown-panel`; non-scoped
    // leak would have applied that. If the value is anything other than
    // 'fixed' (i.e. the browser default 'static'), no leak occurred.
    const position = cs.position;
    document.body.removeChild(el);
    return position;
  });
  expect(leak).not.toBe('fixed');
});
