// Phase 5 Plan 05-05 Task 3 — Modal CSS-vars Playwright spec (Svelte side).
//
// Phase 5 success criterion #5 — validates that Modal.rozie's `:root`
// escape hatch:
//
//   :root {
//     --rozie-modal-z: 2000;
//   }
//
// reaches `document.documentElement` when the Svelte emitter wraps it as
//
//   :global(:root) {
//     --rozie-modal-z: 2000;
//   }
//
// Per RESEARCH.md OQ A4 RESOLVED — Svelte's `:global(:root)` opts the
// rule out of class-hashed scoping so the custom property cascades
// through to the document element. This spec is a runtime regression
// guard — if a future change to `emitStyle.ts` accidentally drops the
// `:global(...)` wrap, the variable would be scoped to the component
// class hash and unreachable from document.documentElement.
//
// Companion to angular-analogjs/modal-css-vars.spec.ts (Plan 05-05 Task 3
// Angular side / ANGULAR-05 runtime validation).
import { test, expect } from '@playwright/test';

test.describe('Phase 5 success criterion #5 — Svelte Modal :root → :global(:root)', () => {
  test('Svelte: --rozie-modal-z reachable from document.documentElement when modal open', async ({
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

  test('Svelte: --rozie-modal-z persists after modal closes (cascade behavior)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('nav-modal').click();
    await page.getByTestId('open-modal').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Close via Escape — Modal.rozie's <listeners> document:keydown.escape
    // wires a $effect that sets $props.open = false (model two-way).
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toBeHidden();

    // After close, the :global(:root) rule's CSS variable persists in the
    // document — Svelte doesn't garbage-collect a globally-scoped style.
    // (If the modal were unmounted AND its :global rule hot-removed, the
    // variable would disappear; verifying persistence proves the rule is
    // actually in the global cascade and not scoped to the modal subtree.)
    const value = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--rozie-modal-z')
        .trim();
    });
    expect(value).toBe('2000');
  });
});
