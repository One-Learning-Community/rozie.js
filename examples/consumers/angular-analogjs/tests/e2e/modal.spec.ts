// Phase 5 Plan 05-04b — Modal spec.
//
// Modal.rozie demonstrates:
//   - model<boolean>(false) for `open` (model: true)
//   - <listeners> with keydown.escape (effect((onCleanup) => Renderer2.listen ...) in constructor)
//   - r-if (full unmount) — modal isn't in tree when closed
//   - $emit('close') → parent receives `close` output (Angular `output<T>()`)
//   - :root { --rozie-modal-z: 2000 } — wraps as ::ng-deep :root in Angular (OQ A4 v1)
//
// REQ ANGULAR-05 — :host-context + ::ng-deep CSS variable propagation.
//
// NOTE: Plan 05-05 has a dedicated CSS-vars Playwright spec validating whether
// the `::ng-deep` wrap is necessary or if it can be simplified — see RESEARCH
// "Open Questions (RESOLVED)" #1 / OQ A4. This spec just verifies basic
// open/close + checks that the variable IS reachable via getComputedStyle.
import { test, expect } from '@playwright/test';

test('Modal opens via prop binding + closes via × button (ANGULAR-05 — model + r-if + output)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-modal').click();

  // Initially closed — modal is unmounted (@if guard on the entire backdrop).
  await expect(page.locator('[role="dialog"]')).toBeHidden();

  // Open via prop binding — AppComponent sets modalOpen.set(true).
  await page.getByTestId('open-modal').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Close via the × button (Modal.rozie close() handler — sets $props.open=false; emits 'close').
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('[role="dialog"]')).toBeHidden();

  // The close output reached AppComponent → close-count text appears.
  await expect(page.getByTestId('modal-close-count')).toBeVisible();
  await expect(page.getByTestId('modal-close-count')).toHaveText('Closed 1 time(s)');
});

test('Modal :root CSS variable --rozie-modal-z is reachable via getComputedStyle (ANGULAR-05)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-modal').click();
  await page.getByTestId('open-modal').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // The :root rule in Modal.rozie's <style> wraps as ::ng-deep :root {
  //   --rozie-modal-z: 2000;
  // } per the Angular emitter (OQ A4 v1). The hosting demo uses Emulated
  // encapsulation (Angular default) so the variable should reach
  // document.documentElement once the Modal is in the DOM tree.
  //
  // Plan 05-05 will tighten the assertion + decide whether the `::ng-deep`
  // wrap is necessary. For Plan 05-04b we only need the variable to be
  // reachable globally.
  const z = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--rozie-modal-z').trim(),
  );
  expect(z).toBe('2000');
});

test('Modal closes on Escape key (ANGULAR-02-style listener via Renderer2.listen)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-modal').click();
  await page.getByTestId('open-modal').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).toBeHidden();
});
