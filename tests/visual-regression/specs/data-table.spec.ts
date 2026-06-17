import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * DataTable behavioral matrix — the headless, accessible, cross-framework data
 * table (`@rozie-ui/data-table`) built on a SINGLE inline `@tanstack/table-core`
 * bridge (NO per-framework adapter — the whole point of the family).
 *
 * Like listbox.spec.ts / slider.spec.ts these are BEHAVIORAL assertions (not
 * pixels — `feedback_vr_linux_baselines`): aria-sort flips, filter narrows rows,
 * pagination changes the page, selection toggles + indeterminate, visibility drops
 * a column, reorder moves a column, pin sticks a column, sticky header stays. Each
 * runs across all six targets. The CSS / role locators pierce Lit's open shadow
 * root.
 *
 * Six demo cells (examples/demos/DataTable*Demo.rozie), each importing
 * ../../packages/ui/data-table/src/{DataTable,Column}.rozie:
 *   1. DataTableColumns        — <Column> vs :columns + 3-distinct-cell-template (req-2/3)
 *   2. DataTableSort           — sort cycle + aria-sort + multi-sort (req-4)
 *   3. DataTableFilterPaginate — global filter + pagination (req-5/6)
 *   4. DataTableSelection      — single/multiple + select-all indeterminate (req-7)
 *   5. DataTableColumnMgmt     — visibility/resize/reorder/pin (req-8-11)
 *   6. DataTableSticky         — sticky header on vertical scroll (req-12)
 *
 * Angular cells MUST mount NON-EMPTY (the slider-missed failure mode): the
 * three-file cross-tree registration (vite.config.ts prebuildExtraRoots +
 * resolveCrossTreeBareImports, tsconfig.app.json include, build-cells.mjs sweep)
 * makes the DataTable + Column .rozie sources get full Angular AOT treatment —
 * missing any one empties EVERY Angular cell.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

// ---------------------------------------------------------------------------
// 1. Column declaration forms (<Column> vs :columns) + 3-distinct-cell-template
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  runnerFor(target)(`data-table-columns [${target}]: <Column> + :columns both render; badge/currency/plain cells project`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableColumns&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const declarative = page.getByTestId('declarative-table');
    const config = page.getByTestId('config-table');
    await expect(declarative).toBeVisible({ timeout: 15_000 });
    await expect(config).toBeVisible({ timeout: 15_000 });

    // Declarative table: 3 columnheaders + 3 body rows mount.
    await expect
      .poll(async () => declarative.locator('[role="columnheader"]').count(), {
        timeout: 15_000,
      })
      .toBe(3);
    await expect
      .poll(async () => declarative.locator('tbody [role="row"]').count(), {
        timeout: 10_000,
      })
      .toBe(3);

    // 3-distinct-cell-template: badge span (template #1) renders the status with a
    // per-value class; currency span (template #2) renders a $-prefixed amount; the
    // Name column has NO template → plain accessor value (the fast path).
    const badges = declarative.getByTestId('cell-badge');
    await expect
      .poll(async () => badges.count(), { timeout: 10_000 })
      .toBe(3);
    await expect(badges.first()).toHaveText('active');

    const currency = declarative.getByTestId('cell-currency');
    await expect
      .poll(async () => currency.count(), { timeout: 10_000 })
      .toBe(3);
    // The currency renderer formats 1299 → "$1,299".
    await expect(currency.first()).toContainText('$1,299');

    // Plain (template-less) Name column renders the bare value.
    await expect(declarative.locator('tbody').first()).toContainText('Alpha');

    // Config-array table renders the SAME three columns as plain values.
    await expect
      .poll(async () => config.locator('[role="columnheader"]').count(), {
        timeout: 15_000,
      })
      .toBe(3);
    await expect
      .poll(async () => config.locator('tbody [role="row"]').count(), {
        timeout: 10_000,
      })
      .toBe(3);
    await expect(config.locator('tbody').first()).toContainText('pending');
  });
}

// ---------------------------------------------------------------------------
// 2. Sorting — aria-sort cycle + multi-column sort (req-4)
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  runnerFor(target)(`data-table-sort [${target}]: aria-sort cycles asc->desc->none; shift-click builds multi-sort`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableSort&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect(mount.locator('table')).toBeVisible({ timeout: 15_000 });

    const readout = page.getByTestId('readout-sorting');
    await expect(readout).toHaveText('[]');

    // The Score columnheader (the third header — index 2 with Name, Status, Score).
    const scoreHeader = mount.locator('[role="columnheader"]').nth(2);
    const scoreButton = scoreHeader.locator('button.rdt-sort-btn').first();

    // none -> ascending
    await scoreButton.click();
    await expect
      .poll(async () => scoreHeader.getAttribute('aria-sort'), {
        timeout: 10_000,
      })
      .toBe('ascending');
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toContain('"score"');

    // ascending -> descending
    await scoreButton.click();
    await expect
      .poll(async () => scoreHeader.getAttribute('aria-sort'), {
        timeout: 10_000,
      })
      .toBe('descending');

    // descending -> none (third click clears)
    await scoreButton.click();
    await expect
      .poll(async () => scoreHeader.getAttribute('aria-sort'), {
        timeout: 10_000,
      })
      .toBe('none');
    await expect(readout).toHaveText('[]');

    // Multi-column sort: click Name, then shift-click Score → a TWO-entry sorting
    // array (Name first, Score second).
    const nameButton = mount
      .locator('[role="columnheader"]')
      .nth(0)
      .locator('button.rdt-sort-btn')
      .first();
    await nameButton.click();
    await scoreButton.click({ modifiers: ['Shift'] });
    await expect
      .poll(
        async () => {
          const txt = (await readout.textContent())?.trim() ?? '[]';
          try {
            return JSON.parse(txt).length as number;
          } catch {
            return 0;
          }
        },
        { timeout: 10_000 },
      )
      .toBe(2);
    const sorting = JSON.parse((await readout.textContent())!.trim());
    expect(sorting[0].id).toBe('name');
    expect(sorting[1].id).toBe('score');
  });
}

// ---------------------------------------------------------------------------
// 3. Filtering + pagination (req-5/6)
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  runnerFor(target)(`data-table-filter-paginate [${target}]: global filter narrows rows; Next changes page`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableFilterPaginate&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect(mount.locator('table')).toBeVisible({ timeout: 15_000 });

    const bodyRows = mount.locator('tbody [role="row"]');
    const pageReadout = page.getByTestId('readout-page');

    // 8 rows, pageSize 3 → page 1 shows 3 rows.
    await expect.poll(async () => bodyRows.count(), { timeout: 15_000 }).toBe(3);
    await expect(pageReadout).toHaveText('Page 1');

    // Pagination: Next → page 2, a DIFFERENT row set (still 3 rows; 3 pages total).
    const firstRowTextPage1 = (await bodyRows.first().textContent())?.trim();
    await mount.locator('button.rdt-page-next').first().click();
    await expect
      .poll(async () => (await pageReadout.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('Page 2');
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(3);
    await expect
      .poll(async () => (await bodyRows.first().textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .not.toBe(firstRowTextPage1);

    // Back to page 1, then global filter → fewer rows. "Paris" appears in 3 rows.
    await mount.locator('button.rdt-page-prev').first().click();
    await expect(pageReadout).toHaveText('Page 1');
    const search = mount.locator('[role="searchbox"]').first();
    await search.fill('Paris');
    await expect
      .poll(async () => bodyRows.count(), { timeout: 10_000 })
      .toBe(3); // 3 Paris rows fit on one page of 3
    // Narrow harder — "Tokyo" appears in 2 rows.
    await search.fill('Tokyo');
    await expect
      .poll(async () => bodyRows.count(), { timeout: 10_000 })
      .toBe(2);
    // Clear → back to 3 (a full page of the 8 rows).
    await search.fill('');
    await expect
      .poll(async () => bodyRows.count(), { timeout: 10_000 })
      .toBe(3);
  });
}

// ---------------------------------------------------------------------------
// 4. Selection — single / multiple + select-all indeterminate (req-7)
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  runnerFor(target)(`data-table-selection [${target}]: multiple select-all goes indeterminate then checked; single caps at 1`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableSelection&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const multi = page.getByTestId('multiple-table');
    const single = page.getByTestId('single-table');
    await expect(multi).toBeVisible({ timeout: 15_000 });
    await expect(single).toBeVisible({ timeout: 15_000 });

    const count = page.getByTestId('readout-count');
    await expect(count).toHaveText('0');

    // Multiple mode: a leading select-all header checkbox + per-row checkboxes.
    const selectAll = multi.locator('input.rdt-select-all').first();
    await expect(selectAll).toBeVisible({ timeout: 10_000 });
    const rowChecks = multi.locator('input.rdt-select-row');
    await expect.poll(async () => rowChecks.count(), { timeout: 10_000 }).toBe(3);

    // Check ONE row → select-all goes indeterminate (some but not all).
    await rowChecks.nth(0).check();
    await expect(count).toHaveText('1');
    await expect
      .poll(async () => selectAll.evaluate((el: HTMLInputElement) => el.indeterminate), {
        timeout: 10_000,
      })
      .toBe(true);

    // Check the rest → select-all fully checked, not indeterminate.
    await rowChecks.nth(1).check();
    await rowChecks.nth(2).check();
    await expect(count).toHaveText('3');
    await expect
      .poll(async () => selectAll.evaluate((el: HTMLInputElement) => el.checked), {
        timeout: 10_000,
      })
      .toBe(true);
    await expect
      .poll(async () => selectAll.evaluate((el: HTMLInputElement) => el.indeterminate), {
        timeout: 10_000,
      })
      .toBe(false);

    // Single mode: no select-all header; checking a second row replaces the first.
    await expect(single.locator('input.rdt-select-all')).toHaveCount(0);
    const singleReadout = page.getByTestId('readout-single');
    const singleChecks = single.locator('input.rdt-select-row');
    await expect
      .poll(async () => singleChecks.count(), { timeout: 10_000 })
      .toBe(3);
    await singleChecks.nth(0).check();
    await expect(singleReadout).toHaveText('1');
    await singleChecks.nth(1).check();
    // Still 1 selected (single mode caps at ≤1).
    await expect(singleReadout).toHaveText('1');
  });
}

// ---------------------------------------------------------------------------
// 5. Column management — visibility / reorder / pin / resize (req-8-11)
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  runnerFor(target)(`data-table-column-mgmt [${target}]: hide drops a column; reorder moves it; pin makes it sticky; resize handle present`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableColumnMgmt&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect(mount.locator('table')).toBeVisible({ timeout: 15_000 });

    const headers = mount.locator('[role="columnheader"]');
    // Name, City, Score → 3 columnheaders.
    await expect.poll(async () => headers.count(), { timeout: 15_000 }).toBe(3);

    // Visibility (req-8): hide City via the imperative handle → header count drops.
    await page.getByTestId('hide-city').click();
    await expect.poll(async () => headers.count(), { timeout: 10_000 }).toBe(2);
    // Body cells for City also drop: each row now has 2 cells.
    await expect
      .poll(
        async () => mount.locator('tbody [role="row"]').first().locator('[role="cell"]').count(),
        { timeout: 10_000 },
      )
      .toBe(2);
    // Restore via the toggle.
    await page.getByTestId('hide-city').click();
    await expect.poll(async () => headers.count(), { timeout: 10_000 }).toBe(3);

    // Reorder (req-10): Score → first column.
    await page.getByTestId('reorder').click();
    await expect
      .poll(
        async () => (await headers.nth(0).textContent())?.trim() ?? '',
        { timeout: 10_000 },
      )
      .toContain('Score');

    // Pinning (req-11): pin Name left → its header gets position:sticky in the
    // inline style (the column.getStart-driven sticky offset).
    await page.getByTestId('pin-name').click();
    const nameHeader = mount.locator('[role="columnheader"]', { hasText: 'Name' }).first();
    await expect
      .poll(
        async () =>
          nameHeader.evaluate((el) => getComputedStyle(el).position),
        { timeout: 10_000 },
      )
      .toBe('sticky');

    // Resize (req-9): the resize handle button is present on a sortable header and
    // resetColumnSizing (the imperative verb) is reachable. The width-delta is owned
    // by table-core's drag; here we assert the handle exists + the reset seam runs
    // without error (a structural proof of the resize wiring).
    await expect(mount.locator('button.rdt-resize-handle').first()).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId('reset-sizing').click();
    // Table still intact after the reset.
    await expect.poll(async () => headers.count(), { timeout: 10_000 }).toBe(3);
  });
}

// ---------------------------------------------------------------------------
// 6. Sticky header on vertical scroll (req-12)
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  runnerFor(target)(`data-table-sticky [${target}]: header is position:sticky and stays pinned during vertical scroll`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableSticky&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect(mount.locator('table')).toBeVisible({ timeout: 15_000 });

    // 20 rows seeded in $onMount → real overflow in the 180px scroll box.
    await expect
      .poll(async () => mount.locator('tbody [role="row"]').count(), {
        timeout: 15_000,
      })
      .toBe(20);

    const header = mount.locator('[role="columnheader"]').first();
    // The sticky-header gate applies position:sticky to the header cells.
    await expect
      .poll(async () => header.evaluate((el) => getComputedStyle(el).position), {
        timeout: 10_000,
      })
      .toBe('sticky');

    // Scroll the container down; the header's top must stay pinned at (≈) the
    // scroll container's top edge (it does not scroll up out of view).
    const box = mount.locator('[data-testid="scroll-box"]').first();
    const headerTopBefore = await header.evaluate((el) => el.getBoundingClientRect().top);
    await box.evaluate((el) => {
      el.scrollTop = 80;
    });
    // allow the layout to settle
    await page.waitForTimeout(100);
    const headerTopAfter = await header.evaluate((el) => el.getBoundingClientRect().top);
    // Sticky → the header top barely moves (within a couple px) despite an 80px scroll.
    expect(Math.abs(headerTopAfter - headerTopBefore)).toBeLessThan(8);
  });
}
