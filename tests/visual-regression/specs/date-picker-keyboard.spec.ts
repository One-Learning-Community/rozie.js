import { test, expect, type Page, type Locator } from '@playwright/test';
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

/**
 * Resolves the CURRENTLY FOCUSED day cell's flat position within the day
 * grid's own render-order `[data-day]` list (0-indexed) — used to assert
 * PageUp/PageDown preserve the SAME grid position (row AND column) across a
 * month swing, rather than just the ISO date (which necessarily differs
 * month to month). `mount.locator(...)` pierces shadow roots automatically
 * (Playwright locator semantics), so this works unmodified on Lit too.
 */
async function focusedDayGridIndex(page: Page, mount: Locator): Promise<number> {
  const info = await activeElementInfo(page);
  if (!info?.dataDay) return -1;
  const allDays = await mount
    .locator('[data-day]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-day')));
  return allDays.indexOf(info.dataDay);
}

/**
 * Resolves the CURRENTLY FOCUSED drill cell's (months or years panel) flat
 * position within its own render-order `[data-month]`/`[data-year]` list
 * (0-indexed) — the drill-panel sibling of `focusedDayGridIndex` above. Same
 * shadow-piercing `mount.locator(...)` approach, so Lit works unmodified.
 * Returns -1 when nothing matching `attr` is currently focused.
 */
async function focusedDrillIndex(
  page: Page,
  mount: Locator,
  attr: 'data-month' | 'data-year',
): Promise<number> {
  const info = await activeElementInfo(page);
  const focusedValue = attr === 'data-month' ? info?.dataMonth : info?.dataYear;
  if (!focusedValue) return -1;
  const allValues = await mount
    .locator(`[${attr}]`)
    .evaluateAll((els, a) => els.map((el) => el.getAttribute(a)), attr);
  return allValues.indexOf(focusedValue);
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
    // moveFocus's cross-month-swing branch defers via scheduleFocus (microtask
    // + rAF) on some targets' async commit — poll rather than one-shot check.
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .toBe('2025-06-18');
    let active = await activeElementInfo(page);
    expect(active?.ariaDisabled).toBe('true');

    // Nav continues past the disabled cell on the next ArrowRight.
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .toBe('2025-06-19');

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
    // Entry focus is deferred via scheduleFocus (microtask + rAF, D-5) — poll
    // rather than a one-shot activeElement check, the same reasoning
    // data-table-grid-navedge.spec.ts uses expect.poll for cross-render focus
    // reads: an async-commit target (e.g. a drill panel's FIRST render) can
    // take more than one microtask/rAF tick to land, and the underlying
    // mechanism is genuinely eventually-consistent, not a one-shot event.
    await mount.locator('.rozie-datepicker-heading-button').focus();
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataMonth, { timeout: 10_000 })
      .toBe('2025-06-01');

    // Escape returns to the days view WITH focus, not <body>.
    await page.keyboard.press('Escape');
    await expect(mount.locator('.rozie-datepicker-grid')).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .toBe('2025-06-15');

    // Drill back in, then further into years via the months-panel year label.
    await mount.locator('.rozie-datepicker-heading-button').focus();
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });
    await mount.locator('.rozie-datepicker-months .rozie-datepicker-drill-label').focus();
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-years')).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataYear, { timeout: 10_000 })
      .toBe('2025-01-01');

    // Pick a year with Enter → focus lands back on a month cell.
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataMonth, { timeout: 10_000 })
      .not.toBeNull();

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
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .toBe('2025-07-13');

    await page.keyboard.press('End');
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .toBe('2025-07-19');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 5. PageUp/PageDown preserve the grid position (row AND column), and
  //    focus never drops across repeated presses (77-09 bug report
  //    2026-08-05). RED before the fix: onDayPage's old landing math only
  //    preserved the COLUMN (`activeDay % 7`), discarding the row — the
  //    FIRST press visibly jumped to the top row, and because that landing
  //    index then repeated on every SUBSEQUENT press (a same-value write the
  //    per-target controller's active-diff guard treats as a no-op), the
  //    SECOND press dropped focus entirely even though the underlying
  //    day-cell DOM nodes had been torn down and recreated for the new
  //    month.
  // -----------------------------------------------------------------------
  runner(`date-picker-keyboard [${target}]: PageUp/PageDown preserve grid position, no lost focus on repeated presses`, async ({
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

    // 2025-06-15 is a Sunday (June 2025 starts on a Sunday, weekStartsOn=0) —
    // row 2, column 0 of the 42-cell month grid: flat index 14. NOT the top
    // row, so a naive "collapse to column" landing would visibly shift it.
    await mount.locator('[data-day="2025-06-15"]').focus();
    expect(await focusedDayGridIndex(page, mount)).toBe(14);

    // ---- first PageUp: month swings back, grid position must be UNCHANGED
    //      (same row AND column — index 14 in the new month's grid), not
    //      collapsed to the top row (index 0-6) ----
    await page.keyboard.press('PageUp');
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .not.toBeNull();
    await expect
      .poll(() => focusedDayGridIndex(page, mount), { timeout: 10_000 })
      .toBe(14);

    // ---- second PageUp: focus must NOT drop even though the landing index
    //      repeats (14 -> 14) and the day-cell DOM nodes were recreated for
    //      yet another new month ----
    await page.keyboard.press('PageUp');
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .not.toBeNull();
    await expect
      .poll(() => focusedDayGridIndex(page, mount), { timeout: 10_000 })
      .toBe(14);

    // ---- PageDown mirrors the same guarantee, across two presses back
    //      toward (and past) the starting month ----
    await page.keyboard.press('PageDown');
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .not.toBeNull();
    await expect
      .poll(() => focusedDayGridIndex(page, mount), { timeout: 10_000 })
      .toBe(14);

    await page.keyboard.press('PageDown');
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .not.toBeNull();
    await expect
      .poll(() => focusedDayGridIndex(page, mount), { timeout: 10_000 })
      .toBe(14);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 6. PageUp from a TOP-ROW starting cell — Dan's exact repro condition
  //    ("having the focused index in the top row before pressing"). With
  //    the pre-fix column-only landing math, index 0 -> column 0 -> index 0
  //    again: a same-value write on the VERY FIRST press, dropping focus
  //    immediately instead of after a second press.
  // -----------------------------------------------------------------------
  runner(`date-picker-keyboard [${target}]: PageUp from a top-row cell does not drop focus on the first press`, async ({
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

    // Land on the grid's TOP-LEFT cell (row 0, col 0 — flat index 0) via
    // Control+Home before pressing PageUp at all.
    await mount.locator('[data-day="2025-06-15"]').focus();
    await page.keyboard.press('Control+Home');
    await expect
      .poll(() => focusedDayGridIndex(page, mount), { timeout: 10_000 })
      .toBe(0);

    await page.keyboard.press('PageUp');
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .not.toBeNull();
    await expect
      .poll(() => focusedDayGridIndex(page, mount), { timeout: 10_000 })
      .toBe(0);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 7. Drill-panel r-keynav grid keys (77-11 gap closure — KNG-08). The
  //    months and years panels are `r-keynav:tabindex.grid(3)` roots exactly
  //    like the day grid, but NOTHING ever pressed a key inside them before
  //    this test — the coverage hole the verifier named. RED on Angular
  //    without plan 77-10's reactive re-attach fix (dead delegation on any
  //    keynav root, drill panels included).
  //
  //    INDEX-RELATIVE by construction: every assertion is anchored by a
  //    Control+Home press FIRST, so the sequence is independent of the
  //    drill's entry-seeding value and stays green on Lit despite the filed
  //    drill-seeding deferral (deferred-items.md) — only the SEEDED entry
  //    value is a known Lit gap, not the r-keynav delegation this test
  //    proves. Control+Home is itself an r-keynav-delegated key, so it is
  //    the very first assertion that goes red when delegation is dead.
  //
  //    Column stride is 3 (r-keynav:tabindex.grid(3)), 12 cells per drill
  //    (0-11): ArrowRight +1, ArrowDown +3, End/Home resolve within the
  //    active row, Ctrl+Home/Ctrl+End resolve the whole-grid corners.
  //    PageUp/PageDown are proven explicit no-ops (`onDrillPage` — SPEC
  //    §4.1's clamp-equivalent default; see 77-07-SUMMARY.md).
  // -----------------------------------------------------------------------
  runner(`date-picker-keyboard [${target}]: drill panels navigate with r-keynav grid keys`, async ({
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

    // ---- Months drill panel ----
    await mount.locator('.rozie-datepicker-heading-button').focus();
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-months')).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Control+Home');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(0);

    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(1);

    await page.keyboard.press('ArrowDown');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(4);

    await page.keyboard.press('End');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(5);

    await page.keyboard.press('Home');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(3);

    await page.keyboard.press('ArrowUp');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(0);

    await page.keyboard.press('Control+End');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(11);

    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(10);

    // Paging no-op: onDrillPage is an explicit no-op — the machine never
    // lands active on a page event, so the index must not move either way.
    await page.keyboard.press('PageDown');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(10);
    await page.keyboard.press('PageUp');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-month'), { timeout: 10_000 })
      .toBe(10);

    // ---- Years drill panel (drill further via the months header label) ----
    await mount.locator('.rozie-datepicker-months .rozie-datepicker-drill-label').focus();
    await page.keyboard.press('Enter');
    await expect(mount.locator('.rozie-datepicker-years')).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Control+Home');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(0);

    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(1);

    await page.keyboard.press('ArrowDown');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(4);

    await page.keyboard.press('End');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(5);

    await page.keyboard.press('Home');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(3);

    await page.keyboard.press('ArrowUp');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(0);

    await page.keyboard.press('Control+End');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(11);

    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(10);

    await page.keyboard.press('PageDown');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(10);
    await page.keyboard.press('PageUp');
    await expect
      .poll(() => focusedDrillIndex(page, mount, 'data-year'), { timeout: 10_000 })
      .toBe(10);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
}
