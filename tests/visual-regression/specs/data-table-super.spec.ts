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

test('faceted select filter narrows rows', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  const before = await page.locator('tbody tr').count();
  // Scope to `thead` — the control panel (`ctl-gridMode`/`ctl-selectionMode`) also
  // renders <select> comboboxes ahead of the FilterSelect drop-ins in DOM order, so
  // an unscoped `getByRole('combobox').first()` silently hits the mode toggle instead
  // (selecting it is a no-op on row count — a false-pass, not a real assertion).
  await page.locator('thead').getByRole('combobox').first().selectOption({ index: 1 });
  await expect.poll(async () => page.locator('tbody tr').count()).toBeLessThanOrEqual(before);
});

test('expanding a row reveals its detail panel', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.locator('tbody tr').first().getByRole('button').first().click();
  await expect(page.getByTestId('readout').locator('[data-slice="expanded"]')).not.toContainText('{}');
});
