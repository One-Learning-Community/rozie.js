import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @rozie-ui/date-picker KEYBOARD/FOCUS behavioral spec (quick task 260802-hla) —
 * the RED-first proof of the three release-blocking defects (focus trap on a
 * disabled day, zero-tab-stop grid unreachability after a month nav swings the
 * selection off-view, drill transitions dropping focus) plus the adjacent
 * Home/End-in-month-2 bug.
 *
 * `examples/demos/DatePickerBehaviorDemo.rozie` is extended with exactly one
 * prop (`:disabledDates="['2025-06-18']"`) so a mid-row disabled day exists —
 * June 2025 starts on a Sunday, so 2025-06-18 is a Wednesday, column 3 of the
 * 15..21 row (ideal for both the arrow-past and the Home/End geometry).
 *
 * PER-TARGET activeElement READ: `getRootNode().activeElement` is the Lit
 * shadow-safe read (`document.activeElement` on Lit returns the HOST element,
 * not the focused cell inside its shadow root) — recursed here since (unlike
 * data-table-grid-navedge.spec.ts) we don't have a known container element to
 * anchor the read on; we walk from `document.activeElement` down through any
 * nested shadow root until the trail ends.
 *
 * BEHAVIOR-ONLY: every assertion is focused-element identity (`[data-day]` /
 * `[data-month]` / `[data-year]` attribute) or attribute state, never a
 * screenshot (snapshot-tests-cement-bugs).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return built ? test : test.fixme;
}

/**
 * Reads the currently focused element's identity, recursing into nested shadow
 * roots (the Lit custom element hosts the day/month/year grid in its own shadow
 * root; `document.activeElement` there is the HOST element, not the cell).
 */
async function activeElementInfo(page: Page): Promise<{
  tag: string;
  dataDay: string | null;
  dataMonth: string | null;
  dataYear: string | null;
  ariaDisabled: string | null;
} | null> {
  return page.evaluate(() => {
    const descend = (root: Document | ShadowRoot): Element | null => {
      const active = root.activeElement;
      if (!active) return null;
      const sr = (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (sr) {
        const inner = descend(sr);
        if (inner) return inner;
      }
      return active;
    };
    const active = descend(document);
    if (!active) return null;
    return {
      tag: active.tagName.toLowerCase(),
      dataDay: active.getAttribute('data-day'),
      dataMonth: active.getAttribute('data-month'),
      dataYear: active.getAttribute('data-year'),
      ariaDisabled: active.getAttribute('aria-disabled'),
    };
  });
}

for (const target of TARGETS) {
  const runner = runnerFor(target);

  // -----------------------------------------------------------------------
  // 1. Arrow past a disabled day: focus never dead-stops on the disabled cell,
  //    and Enter on the disabled (but now-focusable) cell is inert.
  //    RED today: focus never leaves 2025-06-17 (`.focus()` no-ops on a
  //    natively `:disabled` button).
  // -----------------------------------------------------------------------
  runner(`date-picker-keyboard [${target}]: arrow past a disabled day, Enter on it stays inert`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('[data-day="2025-06-17"]')).toBeVisible({ timeout: 10_000 });

    await mount.locator('[data-day="2025-06-17"]').focus();
    await page.keyboard.press('ArrowRight');
    let active = await activeElementInfo(page);
    expect(active?.dataDay, 'ArrowRight from 06-17 must land on the disabled 06-18 cell').toBe(
      '2025-06-18',
    );
    expect(active?.ariaDisabled).toBe('true');

    // Nav continues past the disabled cell on the next ArrowRight.
    await page.keyboard.press('ArrowRight');
    active = await activeElementInfo(page);
    expect(active?.dataDay).toBe('2025-06-19');

    // Focusable but inert: Enter on the disabled day does not select it.
    await mount.locator('[data-day="2025-06-18"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('readout-date')).toHaveText('2025-06-15');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 2. Tab-reachability after month nav with a selection off-view: the grid
  //    always exposes EXACTLY ONE keyboard tab stop.
  //    RED today: tab-stop count is 0 once the selection scrolls off-view.
  // -----------------------------------------------------------------------
  runner(`date-picker-keyboard [${target}]: exactly one day tab-stop, follows the roving fallback after month nav`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('[data-day="2025-06-15"]')).toBeVisible({ timeout: 10_000 });

    const tabStops = mount.locator('[data-day][tabindex="0"]');
    await expect(tabStops).toHaveCount(1, { timeout: 10_000 });
    await expect(tabStops.first()).toHaveAttribute('data-day', '2025-06-15');

    // Step forward a month: the selected day (June 15) is no longer rendered.
    // Today is not necessarily in a 2025 view either, so the roving resolver's
    // first-enabled-in-month fallback must own the single tab stop.
    await mount.locator('.rozie-datepicker-next').click();
    await expect(mount.locator('[data-day="2025-07-01"]')).toBeVisible({ timeout: 10_000 });

    await expect(tabStops).toHaveCount(1, { timeout: 10_000 });
    await expect(tabStops.first()).toHaveAttribute('data-day', '2025-07-01');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 3. Drill enter/exit focus continuity: entering/exiting the months/years
  //    panels via the keyboard keeps focus inside the control the whole time.
  //    RED today: focus stays on the heading button / falls to <body>.
  // -----------------------------------------------------------------------
  runner(`date-picker-keyboard [${target}]: drill enter/exit keeps keyboard focus continuity`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('[data-day="2025-06-15"]')).toBeVisible({ timeout: 10_000 });

    // Drill days → months via the keyboard (Enter on the heading button —
    // the browser's native button-activation path, same handler as click).
    await mount.locator('.rozie-datepicker-heading-button').focus();
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });
    let active = await activeElementInfo(page);
    expect(active?.dataMonth, 'entering the months view must land focus on a month cell').toBe(
      '2025-06-01',
    );

    // Escape returns to the days view WITH focus, not <body>.
    await page.keyboard.press('Escape');
    await expect(mount.locator('.rozie-datepicker-grid')).toBeVisible({ timeout: 10_000 });
    active = await activeElementInfo(page);
    expect(active?.dataDay, 'Escape from months must return focus to the day grid').toBe(
      '2025-06-15',
    );

    // Drill back in, then further into years via the months-panel year label.
    await mount.locator('.rozie-datepicker-heading-button').focus();
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });
    await mount.locator('.rozie-datepicker-months .rozie-datepicker-drill-label').focus();
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-years')).toBeVisible({ timeout: 10_000 });
    active = await activeElementInfo(page);
    expect(active?.dataYear, 'entering the years view must land focus on the anchor year cell').toBe(
      '2025-01-01',
    );

    // Pick a year with Enter → focus lands back on a month cell.
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });
    active = await activeElementInfo(page);
    expect(active?.dataMonth, 'picking a year must land focus on a month cell').not.toBeNull();

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 4. Home/End in month 2 of a two-month view (read-only fixture — has a PNG
  //    baseline, do not modify).
  //    RED today: weekdayOffset scans month-0-only → Home no-ops, End
  //    overshoots to 2025-07-22.
  // -----------------------------------------------------------------------
  runner(`date-picker-keyboard [${target}]: Home/End resolve correctly in month 2 of a multi-month view`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerTwoMonth&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const grids = mount.locator('.rozie-datepicker-grid');
    await expect(grids).toHaveCount(2, { timeout: 10_000 });
    const july = grids.nth(1);
    await expect(july.locator('[data-day="2025-07-16"]')).toBeVisible({ timeout: 10_000 });

    await july.locator('[data-day="2025-07-16"]').focus();
    await page.keyboard.press('Home');
    let active = await activeElementInfo(page);
    expect(active?.dataDay, 'Home in month 2 must resolve within month 2\'s own week row').toBe(
      '2025-07-13',
    );

    await page.keyboard.press('End');
    active = await activeElementInfo(page);
    expect(active?.dataDay).toBe('2025-07-19');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
}
