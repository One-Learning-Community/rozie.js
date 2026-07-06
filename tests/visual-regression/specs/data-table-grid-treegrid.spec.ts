import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-8 (C2 LOCKED: land + treegrid semantics) — the grid treegrid-semantics
 * battery. Drives `examples/demos/DataTableGroupTreegridDemo.rozie` (navigated
 * `?example=DataTableGroupTreegrid`, the host appends the 'Demo' suffix) across all six
 * targets and proves, INSIDE the real DataTable.rozie with full table-core grouping chrome:
 *
 *   LAND — with interactionMode='grid' + grouping active, the active cell LANDS on the
 *          flattened group-header rows (ArrowUp/ArrowDown do NOT skip them): a real
 *          gridcell with data-row/data-col-index inside a group-header <tr>.
 *   ARIA — each group-header <tr> carries role=row + aria-level (the group depth, 1-based)
 *          + aria-expanded reflecting expanded/collapsed; leaf rows carry aria-level too.
 *          Collapsing a group flips its aria-expanded → "false".
 *   TOGGLE — with the active cell on a group cell, Enter toggles that group's collapse
 *          (leaf rows appear/disappear) and aria-expanded updates. Group cells stay
 *          non-editable so Enter never mis-routes to a cell edit.
 *   COHERENCE — ArrowDown from an EXPANDED group header lands on its first leaf; ArrowUp
 *          from a group's first leaf lands back on the group header; ArrowDown from a
 *          COLLAPSED group header lands on the NEXT group header (leaf rows hidden).
 *
 * Each assertion is RED on the pre-fix build (active cell skipped group rows; no
 * aria-expanded/aria-level on the <tr>; Enter on a group cell focused the toggle button
 * instead of toggling) and GREEN after the C2 fix (SC-1). DOM/behavioral, NOT screenshot
 * (the data-table-grid.spec.ts precedent — nav facts are exact DOM, not pixels).
 *
 * PER-TARGET activeElement READ (A1): the active cell is read through Lit's shadow root
 * uniformly via `getRootNode().activeElement` (document in the 5 light-DOM targets, the
 * shadow root inside Lit). The grid <table role="grid"> is found by walking all open
 * shadow roots (the data-table-grid.spec.ts helper, reused).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// KNOWN_FAILING stays EMPTY (the P49/P53 precedent). An un-built target leg surfaces as a
// build-gated `runnerFor` placeholder, NOT a permanent fixme.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

/**
 * The active cell's coordinates + its owning <tr>'s treegrid attributes, read off the
 * focused element UNIFORM across all six (incl. Lit shadow) via getRootNode().activeElement.
 * Returns null when nothing inside the grid is focused.
 */
async function activeProbe(page: Page): Promise<{
  row: string | null;
  col: string | null;
  role: string | null;
  isGroupHeader: boolean;
  isGroupLeaf: boolean;
  trRole: string | null;
  ariaExpanded: string | null;
  ariaLevel: string | null;
} | null> {
  return page.evaluate(() => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findGridTable(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const grid = findGridTable(document);
    if (!grid) return null;
    const active = grid.getRootNode
      ? (grid.getRootNode() as Document | ShadowRoot).activeElement
      : document.activeElement;
    if (!active) return null;
    const cell = active.closest('[data-grid-cell]');
    const tr = cell ? cell.closest('tr') : null;
    return {
      row: cell ? cell.getAttribute('data-row') : null,
      col: cell ? cell.getAttribute('data-col-index') : null,
      role: cell ? cell.getAttribute('role') : null,
      isGroupHeader: !!(tr && tr.hasAttribute('data-group-header')),
      isGroupLeaf: !!(tr && tr.hasAttribute('data-group-leaf')),
      trRole: tr ? tr.getAttribute('role') : null,
      ariaExpanded: tr ? tr.getAttribute('aria-expanded') : null,
      ariaLevel: tr ? tr.getAttribute('aria-level') : null,
    };
  });
}

/** Count the rendered group-header rows (data-group-header) inside the grid table. */
async function groupHeaderCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findGridTable(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const grid = findGridTable(document);
    if (!grid) return -1;
    return grid.querySelectorAll('tbody tr[data-group-header]').length;
  });
}

/** Count the rendered leaf rows (data-group-leaf) inside the grid table. */
async function leafCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findGridTable(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const grid = findGridTable(document);
    if (!grid) return -1;
    return grid.querySelectorAll('tbody tr[data-group-leaf]').length;
  });
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-treegrid [${target}]: active cell lands on group rows; aria-expanded/level treegrid semantics; Enter toggles; cross-boundary nav coherence`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGroupTreegrid&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('treegrid-table');
    const gridTable = gridContainer.locator('table');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    // Grouping engaged at mount → two group-header rows + four leaf rows render.
    await expect.poll(async () => groupHeaderCount(page), { timeout: 15_000 }).toBe(2);
    await expect.poll(async () => leafCount(page), { timeout: 15_000 }).toBe(4);

    // ===================================================================
    // ARIA — the group-header <tr> carries role=row + aria-level (1) + aria-expanded
    //        ("true" while expanded). RED pre-fix: the group <tr> has no aria-expanded
    //        / aria-level. The first group-header row is the grouping by category.
    // ===================================================================
    const firstGroupTr = gridContainer.locator('tbody tr[data-group-header]').first();
    await expect(firstGroupTr).toHaveAttribute('role', 'row');
    await expect(firstGroupTr).toHaveAttribute('aria-level', '1');
    await expect(firstGroupTr).toHaveAttribute('aria-expanded', 'true');
    // Leaf rows carry an aria-level (one deeper → 2) for the treegrid hierarchy.
    await expect(gridContainer.locator('tbody tr[data-group-leaf]').first()).toHaveAttribute(
      'aria-level',
      '2',
    );

    // ===================================================================
    // LAND + COHERENCE (expanded) — the entry cell is the first body cell (row 0, col 0),
    //   which under grouping IS the first group-header row. ArrowDown lands on its first
    //   LEAF (row 1); ArrowUp lands BACK on the group header (row 0); the active cell is
    //   never skipped past the group row.
    // ===================================================================
    const entry = gridContainer.locator('[tabindex="0"]').first();
    await expect(entry).toHaveAttribute('data-row', '0');
    await entry.focus();
    // The active cell sits ON a group-header row (LAND — not skipped).
    await expect
      .poll(async () => (await activeProbe(page))?.isGroupHeader ?? false, { timeout: 10_000 })
      .toBe(true);
    await expect
      .poll(async () => (await activeProbe(page))?.row, { timeout: 10_000 })
      .toBe('0');

    // ArrowDown from the EXPANDED group header → its first leaf (row 1).
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => (await activeProbe(page))?.row, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => (await activeProbe(page))?.isGroupLeaf ?? false, { timeout: 10_000 })
      .toBe(true);

    // ArrowUp from the group's first leaf → BACK on the group header (row 0). The active
    // cell LANDS on the group row (RED pre-fix would skip it / not mark it a group header).
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await activeProbe(page))?.row, { timeout: 10_000 })
      .toBe('0');
    await expect
      .poll(async () => (await activeProbe(page))?.isGroupHeader ?? false, { timeout: 10_000 })
      .toBe(true);

    // ===================================================================
    // TOGGLE — Enter on the active group cell collapses the group (its two leaf rows
    //   disappear → leaf count drops from 4 to 2) and aria-expanded flips to "false".
    //   RED pre-fix: Enter focuses the group-toggle button (enterControl) instead of
    //   toggling, so the leaf count stays 4 and aria-expanded never appears.
    // ===================================================================
    await page.keyboard.press('Enter');
    await expect.poll(async () => leafCount(page), { timeout: 10_000 }).toBe(2);
    await expect(
      gridContainer.locator('tbody tr[data-group-header]').first(),
    ).toHaveAttribute('aria-expanded', 'false');

    // ===================================================================
    // COHERENCE (collapsed) — with the active cell still on the now-collapsed first group
    //   header (row 0), ArrowDown lands on the NEXT group header (the Veg group), which is
    //   now the immediately-following visible row (its leaves are the only ones left). The
    //   active cell is on a group-header row. RED pre-fix: the group never collapsed, so
    //   ArrowDown lands on a leaf instead.
    // ===================================================================
    await expect
      .poll(async () => (await activeProbe(page))?.row, { timeout: 10_000 })
      .toBe('0');
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => (await activeProbe(page))?.isGroupHeader ?? false, { timeout: 10_000 })
      .toBe(true);
    await expect
      .poll(async () => (await activeProbe(page))?.row, { timeout: 10_000 })
      .toBe('1');

    // Re-expand the first group via Enter on its (re-focused) header to prove the toggle is
    // bidirectional. Re-seat the active cell on the first group header first.
    const firstHeaderCell = gridContainer.locator(
      'tbody tr[data-group-header] [data-grid-cell][data-row="0"]',
    ).first();
    await firstHeaderCell.click();
    await expect
      .poll(async () => (await activeProbe(page))?.row, { timeout: 10_000 })
      .toBe('0');
    await page.keyboard.press('Enter');
    await expect.poll(async () => leafCount(page), { timeout: 10_000 }).toBe(4);
    await expect(
      gridContainer.locator('tbody tr[data-group-header]').first(),
    ).toHaveAttribute('aria-expanded', 'true');
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// PLACEHOLDER-BLANK (grouping fix 260706-h2d) — on a group-header row, a PLACEHOLDER cell
//   renders BLANK (no leaked first-leaf value), while AGGREGATED cells still render. A
//   placeholder cell (cell.getIsPlaceholder()) only exists under MULTI-LEVEL grouping: a
//   cell whose column IS a grouping column but NOT the one this row is grouped by. The
//   DataTableGroupPlaceholder fixture groups by ['region','city']; on the top-level REGION
//   group-header row the `city` cell is a placeholder (city is a grouping column, but that
//   row groups by region) while `product`/`qty` are aggregated. table-core fills a
//   placeholder cell's getValue() with the FIRST leaf row's value, so pre-fix the region
//   row's city cell leaked "Oslo". The cellIsPlaceholder r-else-if empty branch suppresses
//   that leak; aggregated cells (carrying [data-agg-cell]) are unchanged.
//
//   RED pre-fix: the placeholder `city` cell renders "Oslo" (leaked first-leaf) → non-empty.
//   GREEN post-fix: the placeholder cell renders empty text; the aggregated cell still shows
//   its value.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-treegrid [${target}]: multi-level group-header placeholder cell renders blank (no leaked first-leaf value); aggregated cell unchanged`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGroupPlaceholder&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const container = mount.getByTestId('placeholder-table');
    await expect(container.locator('table')).toBeVisible({ timeout: 15_000 });

    // Multi-level grouping engages one frame after mount → group-header rows render
    // (2 top-level region groups + nested city subgroups). This demo is role="table" (NOT
    // grid mode), so wait on the group-header row locator directly rather than the
    // grid-only groupHeaderCount() probe.
    await expect
      .poll(async () => container.locator('tbody tr[data-group-header]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // The FIRST group-header row is the top-level region group (North). Its placeholder cells
    // are grid cells that are NEITHER the grouped cell (no `.rdt-group-value`) NOR aggregated
    // (no `[data-agg-cell]`) — here that is the `city` column cell.
    const firstGroupTr = container.locator('tbody tr[data-group-header]').first();
    const placeholderCells = firstGroupTr.locator(
      '[data-grid-cell]:not(:has(.rdt-group-value)):not([data-agg-cell])',
    );

    // The multi-level fixture yields exactly one placeholder cell (`city`) on the region row —
    // assert it exists so the blank check can't vacuously pass.
    await expect.poll(async () => placeholderCells.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    // The placeholder city cell is the one addressed by data-col.
    const cityPlaceholder = firstGroupTr.locator('[data-grid-cell][data-col="city"]');
    await expect(cityPlaceholder).toHaveCount(1, { timeout: 15_000 });

    const count = await placeholderCells.count();
    for (let i = 0; i < count; i++) {
      // GREEN post-fix: blank. RED pre-fix: the leaked first-leaf value ("Oslo").
      await expect(placeholderCells.nth(i)).toHaveText('', { timeout: 15_000 });
    }

    // AGGREGATED cells still render their rolled-up value — UNCHANGED by the fix. The `qty`
    // column carries aggregationFn="sum", so on the North region row it shows the summed value
    // (3+5+2 = 10). It flows through the #cell r-else (NOT the placeholder empty branch): it
    // carries [data-agg-cell] AND renders non-empty text.
    const qtyAgg = firstGroupTr.locator('[data-grid-cell][data-col="qty"]');
    await expect(qtyAgg).toHaveCount(1, { timeout: 15_000 });
    await expect(qtyAgg).toHaveAttribute('data-agg-cell', 'qty', { timeout: 15_000 });
    await expect(qtyAgg).toHaveText('10', { timeout: 15_000 });
  });
}
