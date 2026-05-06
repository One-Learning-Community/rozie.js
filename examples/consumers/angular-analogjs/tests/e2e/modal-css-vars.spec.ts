// Phase 5 Plan 05-05 Task 3 — Modal CSS-vars Playwright spec (Angular side).
//
// Phase 5 success criterion #5 / ANGULAR-05 runtime validation — verifies
// that Modal.rozie's `:root` escape hatch:
//
//   :root {
//     --rozie-modal-z: 2000;
//   }
//
// reaches `document.documentElement` after the Angular emitter wraps it as
//
//   ::ng-deep :root {
//     --rozie-modal-z: 2000;
//   }
//
// per OQ A4 RESOLVED v1 (Plan 05-04a `emitStyle.ts`).
//
// Outcome documentation in 05-05-SUMMARY.md:
//   - PASS WITH ::ng-deep: A4 v1 disposition confirmed; `::ng-deep :root`
//     wrap is the correct shipping form.
//   - PASS WITHOUT ::ng-deep (i.e., this test passes if we manually
//     remove the wrap from the emitter and try again): document v2
//     simplification opportunity for a future plan.
//   - FAIL WITH ::ng-deep: A4 v2 fallback required — sibling .global.css
//     virtual id strategy mirroring Phase 4 D-54 React pattern; document
//     in deferred-items.md.
//
// Companion to svelte-vite/modal-css-vars.spec.ts (Plan 05-05 Task 3
// Svelte side / SVELTE-05 runtime validation).
import { test, expect } from '@playwright/test';

test.describe('Phase 5 success criterion #5 — Angular Modal :root via ::ng-deep :root v1', () => {
  test('Angular: --rozie-modal-z reachable from document.documentElement when modal open', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('nav-modal').click();
    await page.getByTestId('open-modal').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const value = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--rozie-modal-z')
        .trim();
    });
    expect(value).toBe('2000');
  });

  test('Angular: --rozie-modal-z persists after modal closes (cascade behavior)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('nav-modal').click();
    await page.getByTestId('open-modal').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Close via Escape — Modal.rozie's <listeners> document:keydown.escape
    // wires an effect((onCleanup) => Renderer2.listen(...)) that sets
    // model<boolean> open=false.
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toBeHidden();

    // After close, the ::ng-deep :root rule's CSS variable persists in
    // the document. Angular's view encapsulation hashes scoped rules into
    // attribute selectors (`[_ngcontent-rozie-modal-c0]`); the ::ng-deep
    // wrap pierces encapsulation so the rule applies to the global
    // document tree and survives modal unmount.
    const value = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--rozie-modal-z')
        .trim();
    });
    expect(value).toBe('2000');
  });
});
