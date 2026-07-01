import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @rozie-ui/date-picker NAV + ERGONOMICS behavioral spec (Phase 70) — the
 * NON-SNAPSHOT proof of the four SPEC-locked feature behaviors plus the
 * numberOfMonths byte-identity DOM-shape assertion (snapshot-tests-cement-bugs).
 *
 * Four feature demos are driven at the DOM level (a static PNG cannot prove a
 * drill state machine, a range band spanning two month columns, a footer
 * commit/clear path, or that a weekend click is refused):
 *
 *   1. DRILL-JUMP (DatePickerMonthsView / DatePickerYearsView cells,
 *      monthYearNav default-on): clicking the heading button drills days →
 *      months (a `[data-month]` grid), the months-panel year label drills
 *      months → years (a `[data-year]` grid), and picking a cell drills back up.
 *   2. MULTI-MONTH RANGE SPANNING COLUMNS (DatePickerTwoMonth cell, range mode):
 *      a start day in the FIRST rendered month + an end day in the SECOND
 *      rendered month completes a range whose `.is-in-range` band is present in
 *      BOTH month grids. NOTE: commitRange re-anchors `viewIso` to the END day on
 *      completion (so the view shifts to the end month + the next month); to
 *      assert the band across BOTH displayed columns we step the prev-month nav
 *      once, back to the start+end spanning view — the completed range endpoints
 *      then light range-start in the first grid and range-end in the second.
 *   3. FOOTER (DatePickerFooter cell, single mode): Today commits the current
 *      date (readout goes non-empty), Clear deselects (readout empties).
 *   4. WEEKEND-DISABLE (DatePickerWeekendDisable cell, disabledDaysOfWeek=[0,6]):
 *      a Saturday and a Sunday cell are aria-disabled + disabled, and a click on
 *      a disabled weekend day is refused (the readout is unchanged).
 *
 * Plus a mechanical numberOfMonths DOM-shape assertion: the unset-default cell
 * and the explicit numberOfMonths=1 cell render EXACTLY ONE `.rozie-datepicker-grid`
 * with the root FREE of the `.rozie-datepicker--multi` modifier, while
 * numberOfMonths=2 renders TWO grids WITH the modifier — catching a non-visual
 * multi-month layout regression (there is no separate wrapper ELEMENT in this
 * family: the N grids are direct children of the root and the layout is a root
 * modifier class, so "wrapper absent" == "grid count 1 + no --multi modifier").
 *
 * BEHAVIORAL-ONLY (no toHaveScreenshot). Per feedback_vr_linux_baselines a
 * structural spec runs locally without any Docker baseline; the build-availability
 * gate registers unbuilt targets as test.fixme (the leaflet-map / range-behavior
 * precedent). Playwright css locators pierce the Lit shadow boundary by default,
 * so `mount.locator(...)` reaches the shadowed grid on Lit too.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = built ? test : test.fixme;

  // -----------------------------------------------------------------------
  // 1a. DRILL — days → months → (pick a month) → back to days with the new
  //     heading. Asserts the `[data-month]` grid appears and the day grid
  //     returns after a month pick.
  // -----------------------------------------------------------------------
  runner(`date-picker-drill [${target}]: days → months → pick month`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerMonthsView&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Seeded June 2025 day grid renders.
    await expect(mount.locator('[data-day="2025-06-15"]')).toBeVisible({ timeout: 10_000 });
    await expect(mount.locator('.rozie-datepicker-grid')).toHaveCount(1);

    // Drill into the months view via the heading button.
    await mount.locator('.rozie-datepicker-heading-button').click();
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });
    // The 12-month grid appears; the day grid is gone.
    await expect(mount.locator('[data-month]')).toHaveCount(12);
    await expect(mount.locator('.rozie-datepicker-grid')).toHaveCount(0);

    // Pick March 2025 → drills back to the days view with the new heading.
    await mount.locator('[data-month="2025-03-01"]').click();
    await expect(mount.locator('.rozie-datepicker-grid')).toHaveCount(1);
    await expect(mount.locator('.rozie-datepicker-heading-button')).toContainText('March');
    await expect(mount.locator('.rozie-datepicker-months')).toHaveCount(0);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 1b. DRILL — days → months → years → (pick a year) → back to months.
  //     Asserts the `[data-year]` grid appears and drilling up returns to months.
  // -----------------------------------------------------------------------
  runner(`date-picker-drill [${target}]: months → years → pick year`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerYearsView&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('[data-day="2025-06-15"]')).toBeVisible({ timeout: 10_000 });

    // days → months.
    await mount.locator('.rozie-datepicker-heading-button').click();
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });

    // months → years (the months-panel year label drills further down).
    await mount.locator('.rozie-datepicker-months .rozie-datepicker-drill-label').click();
    await expect(mount.locator('.rozie-datepicker-years')).toBeVisible({ timeout: 10_000 });
    await expect(mount.locator('[data-year]')).toHaveCount(12);

    // Pick a year → drills back UP to the months view.
    await mount.locator('[data-year]').first().click();
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });
    await expect(mount.locator('.rozie-datepicker-years')).toHaveCount(0);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 2. MULTI-MONTH RANGE SPANNING COLUMNS (DatePickerTwoMonth, range mode).
  //    Select a start in the first month + an end in the second month, then
  //    step back one month so both range months are displayed, and assert the
  //    in-range band + endpoints are present in BOTH grids.
  // -----------------------------------------------------------------------
  runner(`date-picker-two-month [${target}]: range band spans both grids`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerTwoMonth&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // numberOfMonths=2 → two day grids + the multi modifier on the root.
    const grids = mount.locator('.rozie-datepicker-grid');
    await expect(grids).toHaveCount(2, { timeout: 10_000 });
    await expect(mount.locator('.rozie-datepicker')).toHaveClass(/rozie-datepicker--multi/);

    // The seeded range is COMPLETE (Jun10..Jun15) → the first click re-anchors.
    // Start in the FIRST month (June 20), end in the SECOND month (July 05).
    // Scope each click to its grid: an ISO can appear as a spill cell in the
    // sibling grid, so address the in-month cell within the correct column.
    await grids.nth(0).locator('[data-day="2025-06-20"]').click();
    await grids.nth(1).locator('[data-day="2025-07-05"]').click();

    // rangeComplete fired with the cross-month ordered range.
    await expect(page.getByTestId('readout-complete')).toHaveText('2025-06-20…2025-07-05', {
      timeout: 10_000,
    });

    // Completion re-anchored the view to the END month (July) → step back one
    // month so June + July are both displayed again.
    await mount.locator('.rozie-datepicker-prev').click();

    const june = grids.nth(0);
    const july = grids.nth(1);
    // The lower endpoint lights range-start in the FIRST (June) column…
    await expect(june.locator('.is-range-start')).toHaveCount(1, { timeout: 10_000 });
    // …the higher endpoint lights range-end in the SECOND (July) column…
    await expect(july.locator('.is-range-end')).toHaveCount(1);
    // …and the in-range band is present in BOTH columns (the spanning proof).
    expect(await june.locator('.is-in-range').count()).toBeGreaterThan(0);
    expect(await july.locator('.is-in-range').count()).toBeGreaterThan(0);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 3. FOOTER (DatePickerFooter, single mode): Today commits, Clear deselects.
  // -----------------------------------------------------------------------
  runner(`date-picker-footer [${target}]: Today commits, Clear deselects`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerFooter&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const readout = page.getByTestId('footer-readout');
    // Seeded selection.
    await expect(readout).toHaveText('2025-06-15', { timeout: 10_000 });
    await expect(mount.locator('.rozie-datepicker-footer')).toBeVisible();

    // Today → commits the current date (single mode). The readout becomes a
    // fresh ISO date (the wall-clock day, ≠ the seeded June date).
    await mount.locator('.rozie-datepicker-today').click();
    await expect(readout).toHaveText(/^\d{4}-\d{2}-\d{2}$/, { timeout: 10_000 });
    await expect(readout).not.toHaveText('2025-06-15');

    // Clear → deselects (empty readout).
    await mount.locator('.rozie-datepicker-clear').click();
    await expect(readout).toHaveText('', { timeout: 10_000 });

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 4. WEEKEND-DISABLE (DatePickerWeekendDisable, disabledDaysOfWeek=[0,6]):
  //    Saturday + Sunday cells are aria-disabled + disabled; a click on a
  //    disabled weekend day is refused (readout unchanged).
  // -----------------------------------------------------------------------
  runner(`date-picker-weekend [${target}]: weekends disabled + click refused`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerWeekendDisable&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const readout = page.getByTestId('weekend-readout');
    await expect(readout).toHaveText('2025-06-15', { timeout: 10_000 });

    // June 2025 starts on a Sunday → Jun 07 is a Saturday, Jun 08 a Sunday.
    const saturday = mount.locator('[data-day="2025-06-07"]');
    const sunday = mount.locator('[data-day="2025-06-08"]');
    await expect(saturday).toHaveAttribute('aria-disabled', 'true', { timeout: 10_000 });
    await expect(saturday).toBeDisabled();
    await expect(sunday).toHaveAttribute('aria-disabled', 'true');
    await expect(sunday).toBeDisabled();

    // A click on the disabled Saturday is refused — the selection is unchanged.
    // force:true skips the actionability guards; the disabled button emits no
    // click, so the value funnel never runs (belt-and-suspenders: even if the
    // click landed, dayEnabled() gates it).
    await saturday.click({ force: true });
    await expect(readout).toHaveText('2025-06-15');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 5. numberOfMonths DOM-shape (byte-identity): unset-default + explicit =1
  //    render one grid, no --multi modifier; =2 renders two grids + modifier.
  // -----------------------------------------------------------------------
  runner(`date-picker-shape [${target}]: numberOfMonths grid/modifier shape`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Unset default (DatePickerMonthsView passes no numberOfMonths).
    await page.goto(`/?example=DatePickerMonthsView&target=${target}`);
    let mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('.rozie-datepicker-grid')).toHaveCount(1, { timeout: 10_000 });
    await expect(mount.locator('.rozie-datepicker')).not.toHaveClass(/rozie-datepicker--multi/);

    // Explicit numberOfMonths=1.
    await page.goto(`/?example=DatePickerSingleMonth&target=${target}`);
    mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('.rozie-datepicker-grid')).toHaveCount(1, { timeout: 10_000 });
    await expect(mount.locator('.rozie-datepicker')).not.toHaveClass(/rozie-datepicker--multi/);

    // numberOfMonths=2 → two grids + the multi modifier.
    await page.goto(`/?example=DatePickerTwoMonth&target=${target}`);
    mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('.rozie-datepicker-grid')).toHaveCount(2, { timeout: 10_000 });
    await expect(mount.locator('.rozie-datepicker')).toHaveClass(/rozie-datepicker--multi/);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
}
