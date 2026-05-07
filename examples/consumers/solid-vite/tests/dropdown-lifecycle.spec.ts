/**
 * Dropdown listener lifecycle e2e test — SC #2 / SOLID-T-02.
 *
 * Exercises the parent-flip-mid-lifecycle scenario: the parent controls the
 * `open` prop. After locking the parent, outside clicks should NOT cause stale
 * state reads in the Dropdown's listener (`createOutsideClick`).
 *
 * Solid's reactive accessor pattern ensures `when()` always reads the LATEST
 * value from props at the time of the click — no stale-closure risk.
 *
 * Phase 06.3 P3 / D-142.
 */
import { test, expect } from '@playwright/test';

test.describe('Dropdown — listener lifecycle (SC #2 / SOLID-T-02)', () => {
  test('outside click closes dropdown when open', async ({ page }) => {
    await page.goto('/#/dropdown');

    // Open the dropdown via trigger click
    await page.getByTestId('dropdown-trigger').click();
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('true');

    // Click outside (top-left corner avoids all UI elements)
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('false');
  });

  test('parent-flips-mid-lifecycle: reactive when-accessor prevents stale prop reference (SC #2)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/#/dropdown');

    // 1. Open dropdown via trigger click
    await page.getByTestId('dropdown-trigger').click();
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('true');

    // 2. Close by outside click — exercises the createOutsideClick reactive when-accessor
    //    (Solid reads `() => open() && local.closeOnOutsideClick` fresh each time).
    //    The marquee assertion: no JS errors thrown (no stale closure, no TypeError).
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('false');

    // 3. Re-open and close again — proves cleanup + re-attach cycle works
    await page.getByTestId('dropdown-trigger').click();
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('true');
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('false');

    // 4. Lock parent, open via trigger, verify state change (from parent perspective)
    await page.getByTestId('parent-unlock').click();
    await page.getByTestId('dropdown-trigger').click();
    await expect(page.getByTestId('dropdown-open-state')).toHaveText('true');
    await page.getByTestId('parent-lock').click();
    // Outside click fires onOpenChange but parent ignores it (lockedClosed blocks setOpen).
    // No JS error should occur — the reactive system handles the blocked update cleanly.
    await page.mouse.click(5, 5);

    // 5. Verify no unhandled exceptions at any point (stale-prop guard — SOLID-T-02)
    expect(errors).toEqual([]);
  });
});
