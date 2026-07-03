import { test, expect } from '@playwright/test';

test('super demo renders a table in Vue', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await expect(page.getByTestId('dt-super')).toBeVisible();
  await expect(page.locator('table, [role="grid"], [role="table"]')).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('header click updates the sorting readout', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // The columnheader <th> also hosts the per-column filter input, pin controls, and
  // resize handle stacked below the sort button (no flex layout) — clicking the <th>'s
  // center can land on a sibling control. Target the sort toggle button directly (its
  // accessible name is the exact column label; pin/resize buttons' names always carry
  // extra words like "Pin Customer to left", so `exact: true` disambiguates).
  await page.getByRole('button', { name: 'Customer', exact: true }).click();
  await expect(page.getByTestId('readout').locator('[data-slice="sorting"]')).toContainText('customer');
});

test('grid mode exposes role=grid', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByTestId('ctl-gridMode').selectOption('grid');
  await expect(page.locator('[role="grid"]')).toBeVisible();
});

test('virtualization windows the rows', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByTestId('ctl-virtual').check();
  // Two-sided bound (folded-in Task 3 review fix): a one-sided `< 100` also
  // passes on a SILENT construction failure (windowedRows() returning `[]` —
  // 0 rows). Assert `count > 0` (rules out the empty-render regression) AND
  // `count < 100` (rules out the ~1,500 no-window regression). Window ≈
  // 25-30 rows at estimateRowHeight=40 / maxHeight=440px, so `5 < count <
  // 50` is a tight-but-safe real-poll bound.
  await expect.poll(async () => page.locator('tbody tr').count()).toBeGreaterThan(5);
  await expect.poll(async () => page.locator('tbody tr').count()).toBeLessThan(50);
});

test('editing a Customer cell fires cellEditCommit', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // Inline editing's Enter/F2-to-edit keymap lives in onGridKeyDown, which no-ops
  // entirely when `!isGrid()` (gridKeydownHandlers.rzts:6 — `if (!isGrid() || !e)
  // return`). DataTableEditDemo.rozie / DataTableEditorDropinsDemo.rozie both use
  // `interactionMode="grid"` for exactly this reason. The super demo defaults to
  // 'table' mode (ctl-gridMode), so the smoke test must switch modes first — the
  // real keymap requirement, not a weakened assertion.
  await page.getByTestId('ctl-gridMode').selectOption('grid');
  // The demo's default selectionMode is 'multiple' (see ctl-selectionMode), which
  // auto-injects a LEADING checkbox column (D-04/IN-02), and Task 5's
  // `:expandable="true"` auto-injects a chevron expander column right after it
  // (DataTable.rozie: "a leading chevron expander column auto-injects (after the
  // select column)") — so the visible order is [select, expand, id, customer, …].
  // `nth(3)` is the Customer cell, not `nth(2)`.
  const cell = page.locator('tbody tr').first().locator('td').nth(3);
  await cell.click();
  await page.keyboard.press('Enter');
  await cell.locator('input').fill('Zzz Edited');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('readout').locator('[data-slice="lastCommit"]')).toContainText('customer');
});

test('faceted select filter narrows every visible row to the selected category', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // With pageSize:20 and ~375 rows/category out of 1,500, a `count <= before`
  // assertion is near-tautological (both sides are 20 regardless of whether the
  // filter works) — it would NOT catch a broken/no-op FilterSelect. Instead, drive
  // the REAL FilterSelect drop-in (DataTable also renders its own built-in text
  // filter input per column — `aria-label="Filter Category"` — alongside the
  // slotted facet control, so scope to the drop-in's own `aria-label="category"`,
  // NOT the built-in one) and assert every visible row's Category cell equals the
  // selected value. A broken/no-op filter would leave mixed categories in the
  // body and fail this — pagination-independent, so it holds regardless of page
  // size vs. per-category row counts.
  const categorySelect = page.locator('thead').locator('select[aria-label="category"]');
  await categorySelect.selectOption('Hardware');
  const categoryCells = page.locator('tbody td[data-col="category"] .rdt-cell-value');
  await expect.poll(async () => {
    const texts = await categoryCells.allTextContents();
    return texts.length > 0 && texts.every((t) => t === 'Hardware');
  }).toBe(true);
});

test('numeric range filter on Amount narrows every visible row into the range', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // Exercises the FilterNumberRange drop-in wired to the `amount` column (only
  // reachable once `amount` carries `:filterable="true"` — the Task 5 review's
  // Important fix; the #filter slot's `columnId === 'amount'` branch was
  // previously dead code because DataTable gates the `#filter` slot on
  // `columnIsFilterable(columnId)`). FilterNumberRange.rozie applies the range on
  // `@change` (not `@input` — see its `applyRange()` handler), so a bare `.fill()`
  // on both inputs does NOT commit the filter; blurring (Tab) after filling does,
  // matching real user interaction (type into min, tab to max, type, tab out).
  const minInput = page.locator('thead').locator('input[aria-label="amount min"]');
  const maxInput = page.locator('thead').locator('input[aria-label="amount max"]');
  await minInput.fill('200');
  await maxInput.fill('400');
  await maxInput.press('Tab');
  const amountCells = page.locator('tbody td[data-col="amount"] .rdt-cell-value');
  await expect.poll(async () => {
    const texts = await amountCells.allTextContents();
    return (
      texts.length > 0 &&
      texts.every((t) => {
        const n = Number(t);
        return n >= 200 && n <= 400;
      })
    );
  }).toBe(true);
});

test('expanding a row reveals its detail panel', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.locator('tbody tr').first().getByRole('button').first().click();
  await expect(page.getByTestId('readout').locator('[data-slice="expanded"]')).not.toContainText('{}');
});

test('switching theme changes the active data-table stylesheet AND visibly restyles it', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // An id-only assertion (which `<style id="rdt-theme-*">` is `.disabled`)
  // is NOT sufficient — it passed even under the original Task 7 landing's
  // mutually-exclusive swap bug, which disabled base.css's token-wiring the
  // moment a skin was selected, so shadcn/material/bootstrap's remapped
  // tokens landed on custom properties nothing reads and the table silently
  // kept its zero-config look. Assert the REAL computed effect instead: the
  // header cell's `background-color` (driven by `--rdt-header-bg`, which
  // base.css wires from the public `--rozie-data-table-header-bg` token —
  // base.css's value is `rgba(0, 0, 0, 0.03)`, shadcn.css's remapped value
  // is `hsl(var(--muted, 210 40% 96.1%))` — genuinely different colors)
  // must actually CHANGE when switching themes. A broken/no-op swap fails
  // this even if the active stylesheet id still flips.
  const headerCell = page.locator('thead .rdt-th').first();
  const headerBg = () => headerCell.evaluate((el) => getComputedStyle(el).backgroundColor);

  // Under the LAYERED swap, `base` is ALWAYS enabled (a "first non-disabled
  // id" locator would always resolve to `rdt-theme-base` and never change) —
  // so capture the full SET of enabled sheet ids instead: base-only before,
  // base+material after.
  const enabledIds = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('[id^="rdt-theme-"]'))
      .filter((s) => !(s as HTMLStyleElement & { disabled?: boolean }).disabled)
      .map((s) => s.id)
      .sort()
      .join(','));

  // $onMount's style-element injection runs after first paint, so poll
  // rather than asserting synchronously on the very first read.
  await expect.poll(enabledIds).toBe('rdt-theme-base');
  const beforeBg = await headerBg();

  await page.getByTestId('ctl-theme').selectOption('material');

  await expect.poll(enabledIds).toBe('rdt-theme-base,rdt-theme-material');
  await expect.poll(headerBg).not.toBe(beforeBg);
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('imperative expandAll populates expanded; applyGrouping writes grouping', async ({ page }) => {
  // Task 6: the isolated imperative-handle panel is gated OFF by default
  // (ctl-handle) — check it to reveal the $refs.tbl.<verb>() button panel,
  // then drive two side-effecting verbs and assert the effect shows up in
  // the readout ($data.groupingModel underlies the `grouping` slice —
  // Task 6's Angular-landmine rename; the `data-slice="grouping"` locator
  // is unchanged).
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByTestId('ctl-handle').check();
  await page.getByTestId('verb-expandAll').click();
  await expect(page.getByTestId('readout').locator('[data-slice="expanded"]')).not.toContainText('{}');
  await page.getByTestId('verb-applyGrouping').click();
  await expect(page.getByTestId('readout').locator('[data-slice="grouping"]')).toContainText('category');
});
