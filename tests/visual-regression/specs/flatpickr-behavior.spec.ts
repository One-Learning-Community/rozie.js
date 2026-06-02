import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Flatpickr GAP-2/3/4 behavioral smoke (quick 260601-x2p).
 *
 * `examples/demos/FlatpickrBehaviorDemo.rozie` consumes the
 * `packages/ui/flatpickr/src/Flatpickr.rozie` wrapper and exercises the three
 * props 260601-w2o shipped:
 *
 *   - GAP-2 `:disable` — a weekends predicate, toggled at runtime. Flipping the
 *     toggle runs the wrapper's `$watch(() => $props.disable) → set('disable', v)`
 *     reconciler on the LIVE picker (no remount); flatpickr re-renders day cells,
 *     stamping `.flatpickr-disabled` on Saturdays/Sundays.
 *   - GAP-3 `:locale` — an English ⇄ French switch (static `French` import).
 *     Switching runs the locale reconciler (`set('locale', merged)`); flatpickr
 *     re-renders the month label in French.
 *   - GAP-4 `:plugins` — a two-input range via `rangePlugin` (selector form,
 *     `input: '#fp-range-end'`). rangePlugin mirrors the end date into the second
 *     input — the defining rangePlugin behavior.
 *
 * WHY THIS SPEC IS BEHAVIORAL-ONLY (no toHaveScreenshot):
 *
 * 260601-w2o proved the props COMPILE clean across all 6 targets. This spec
 * closes the behavioral-evidence gap with STRUCTURAL assertions on the live
 * flatpickr DOM — no pixel baseline. Per `feedback_vr_linux_baselines`, a
 * structural-only spec runs locally on macOS without any Docker baseline regen.
 *
 * The existing 'Flatpickr' matrix cell (FlatpickrDemo.rozie → Flatpickr.png)
 * stays byte-untouched: this demo is a SEPARATE example key (FlatpickrBehavior)
 * and is deliberately NOT in matrix.spec.ts EXAMPLES.
 *
 * If this spec is red while the 'Flatpickr ·' wrapper matrix cells are green,
 * the regression is in the demo's gap-prop wiring (`:disable` / `:locale` /
 * `:plugins` passthrough) — NOT the wrapper's engine-mount path.
 *
 * flatpickr DOM topology: the wrapper renders `<input class="rozie-flatpickr">`;
 * flatpickr appends the calendar popup (`.flatpickr-calendar`) to
 * `document.body` (LIGHT DOM, page-level) — so popups are queried at PAGE level,
 * the input at MOUNT level. For Lit the input lives in shadow DOM, but
 * Playwright's css locators pierce shadow boundaries by default.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// French month names flatpickr renders into the current-month label when the
// French locale reconciles.
const FRENCH_MONTHS =
  /janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/i;

for (const target of TARGETS) {
  // Build-availability gate — copied from leaflet-map.spec.ts. When the
  // per-target VR sub-build did not produce `dist/<target>/`, the cell is
  // registered with `test.fixme` (known-pending) rather than erroring.
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = built ? test : test.fixme;
  runner(`flatpickr-behavior [${target}]: disable + locale + rangePlugin`, async ({
    page,
  }) => {
    // A clean integration emits zero uncaught errors and zero console.error.
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`/?example=FlatpickrBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // MOUNT — the wrapper's flatpickr input renders. There are two flatpickr
    // instances (main + range); the main picker is the FIRST input. Target
    // flatpickr's own `.flatpickr-input` class (which flatpickr stamps onto the
    // input it manages) rather than the wrapper's `.rozie-flatpickr` class:
    // React CSS-Modules-hashes the wrapper's authored class name
    // (`_rozie-flatpickr_…`), so `.rozie-flatpickr` would not match on React
    // (cf. project_react_classhash_breaks_selectors). `.flatpickr-input` is
    // stable across all six targets.
    const mainInput = mount.locator('input.flatpickr-input').first();
    await expect(mainInput).toBeVisible({ timeout: 10_000 });

    // CALENDAR OPENS — clicking the main input opens its calendar; flatpickr
    // appends `.flatpickr-calendar` to document.body (light DOM) and adds the
    // `.open` class.
    await mainInput.click();
    const openCalendar = page.locator('.flatpickr-calendar.open').first();
    await expect(openCalendar).toBeVisible({ timeout: 10_000 });

    // GAP-2 — DISABLE PREDICATE. With weekends-disable OFF, the open calendar
    // has zero disabled day cells.
    await expect(
      page.locator('.flatpickr-calendar.open .flatpickr-day.flatpickr-disabled'),
    ).toHaveCount(0);

    // Close the calendar before clicking the toggle: the open popup overlays
    // the picker-pane controls and would otherwise intercept the click.
    await page.keyboard.press('Escape');
    await expect(openCalendar).toBeHidden({ timeout: 5_000 });

    // Toggle weekends ON → the wrapper's set('disable') reconciler updates the
    // live picker. Re-open and assert ONLY weekend cells are disabled. There
    // are exactly 12 weekend cells (Sat/Sun) across a 6-week (42-cell) grid;
    // asserting the count is in the weekend band (not the whole grid) proves
    // the predicate is honored rather than the disable set being misapplied.
    await page.getByTestId('toggle-weekends').click();
    await mainInput.click();
    await expect(openCalendar).toBeVisible({ timeout: 10_000 });
    const disabledDays = page.locator(
      '.flatpickr-calendar.open .flatpickr-day.flatpickr-disabled',
    );
    await expect(disabledDays.first()).toBeVisible({ timeout: 10_000 });
    const disabledCount = await disabledDays.count();
    expect(
      disabledCount,
      `expected only weekend cells disabled (~12 in a 42-cell grid), got ${disabledCount}`,
    ).toBeGreaterThan(0);
    expect(
      disabledCount,
      `disabling ALL ${disabledCount} cells means the predicate was not honored`,
    ).toBeLessThan(20);

    // GAP-3 — LOCALE. Switch to French → the locale reconciler re-renders the
    // calendar in French. flatpickr's default `monthSelectorType: 'dropdown'`
    // renders the month as a `<select class="flatpickr-monthDropdown-months">`
    // whose <option> labels are the LOCALIZED month names — so French locale
    // means the options read "janvier"/"février"/… The localized weekday
    // headers (`.flatpickr-weekday`: lun/mar/mer/…) are a second proof. Close +
    // reopen so the control click is not intercepted by the popup.
    await page.keyboard.press('Escape');
    await expect(openCalendar).toBeHidden({ timeout: 5_000 });
    await page.getByTestId('lang-fr').click();
    await mainInput.click();
    await expect(openCalendar).toBeVisible({ timeout: 10_000 });
    const monthOptions = openCalendar
      .locator('select.flatpickr-monthDropdown-months option')
      .first();
    await expect(monthOptions).toHaveText(FRENCH_MONTHS, { timeout: 10_000 });
    // Second proof: the weekday header row is localized to French.
    const weekdays = await openCalendar
      .locator('.flatpickr-weekday')
      .allTextContents();
    expect(
      weekdays.map((w) => w.trim()).join(' '),
      `weekday headers should be French (lun/mar/…), got: ${weekdays.join(',')}`,
    ).toMatch(/lun|mar|mer|jeu|ven|sam|dim/i);
    await page.keyboard.press('Escape');

    // GAP-4 — RANGEPLUGIN two-input range. The second input exists and
    // rangePlugin mirrors the picked end date into it.
    const endInput = page.locator('#fp-range-end');
    await expect(endInput).toBeVisible();

    // Open the range (start) picker. It is the SECOND .flatpickr-input
    // (the main picker is the first). rangePlugin binds the start picker to
    // #fp-range-end; picking two days fills BOTH inputs.
    const rangeStartInput = mount.locator('input.flatpickr-input').nth(1);
    await expect(rangeStartInput).toBeVisible();
    await rangeStartInput.click();

    // The range picker's calendar is now the open one. Pick two enabled,
    // selectable day cells deterministically (not "today"): the 10th, then the
    // 20th of the visible month. `:not(.prevMonthDay):not(.nextMonthDay)` keeps
    // the clicks inside the current month; `:not(.flatpickr-disabled)` avoids
    // any disabled cell.
    const rangeCalendar = page.locator('.flatpickr-calendar.open').first();
    await expect(rangeCalendar).toBeVisible({ timeout: 10_000 });
    const selectableDays = rangeCalendar.locator(
      '.flatpickr-day:not(.prevMonthDay):not(.nextMonthDay):not(.flatpickr-disabled)',
    );
    await expect(selectableDays.first()).toBeVisible({ timeout: 10_000 });
    // Indices 9 and 19 = the 10th and 20th day of the current month.
    await selectableDays.nth(9).click();
    await selectableDays.nth(19).click();

    // rangePlugin mirrors the end date into #fp-range-end — assert it is now
    // populated. Both inputs carry a non-empty value once the range completes.
    await expect(endInput).not.toHaveValue('', { timeout: 10_000 });
    expect(await rangeStartInput.inputValue()).not.toBe('');

    // No uncaught runtime errors and no console.error across all interactions.
    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual(
      [],
    );
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual(
      [],
    );
  });
}
