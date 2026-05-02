// Phase 3 Plan 06 — OQ4 verification anchor (D-47).
//
// Modal.rozie should compile and work via prop binding ALONE — no need for
// an imperative `modalRef.value.open()` call. The page wrapper
// (src/pages/Modal.vue) toggles `modalOpen.value` ref directly, and the
// Modal r-if="$props.open" mounts/unmounts.
//
// If this test FAILS because the Modal cannot be opened/closed via prop
// binding alone, OQ4 fires: IRComponent.expose: ExposeDecl[] must be
// amended (D-47 disposition). Until then, OQ4 stays deferred to v2.
import { test, expect } from '@playwright/test';

test('Modal works via prop binding without $expose (OQ4 verification — D-47)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Modal', exact: true }).click();

  // Initially closed
  await expect(page.locator('[role="dialog"]')).toBeHidden();

  // Open via prop binding — page wrapper sets `modalOpen.value = true`.
  await page.getByRole('button', { name: 'Open Modal' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Close via the × button (calls Modal.rozie's close() handler which sets
  // $props.open = false; emits 'close').
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('[role="dialog"]')).toBeHidden();
});
