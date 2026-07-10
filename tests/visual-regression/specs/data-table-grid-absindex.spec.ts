import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-6 (C1 LOCKED) — ABSOLUTE-INDEX addressing, cross-mode parity battery.
 *
 * One spec pins IDENTICAL focusCell/getActiveCell/activecell-change semantics across the
 * PAGINATED (DataTableGridAbsIndex) and VIRTUAL (DataTableVirtualGrid) modes:
 *
 *   C1 — focusCell(abs)/getActiveCell()/activecell-change rowIndex is the ABSOLUTE
 *        display-order position in getPrePaginationRowModel().rows (filter+sort+expand
 *        applied, BEFORE pagination/windowing), in BOTH modes.
 *        - Paginated: focusCell(7) on a pageSize=3 grid switches to page 3 (floor(7/3)=2)
 *          then focuses the abs-row-7 cell. The previously PAGE-RELATIVE paginated meaning
 *          is REVERSED to absolute (the C1 contract).
 *        - Virtual: focusCell(4000) scrolls-then-focuses the abs-row-4000 cell (already
 *          absolute today — the parity anchor).
 *   converter — getRowIndexRelativeToPage() returns the page-relative index (7 - 2*3 = 1),
 *        mirroring MUI getRowIndexRelativeToVisibleRows.
 *   B27 — every rendered body row carries aria-rowindex == abs+2 in BOTH modes (header-inclusive;
 *        paginated page-3 rows = 8/9/10; virtual abs-4000 row = 4002).
 *
 * RED on the pre-fix build (record per-target in SUMMARY):
 *   - paginated focusCell(7) clamps page-relative (reports 2, not 7); never switches page.
 *   - getRowIndexRelativeToPage is undefined.
 *   - paginated non-virtual rows carry NO aria-rowindex.
 * The virtual block stays GREEN throughout (virtual was already absolute) — it is the parity
 * oracle the paginated block must match after the fix.
 *
 * DOM assertions only (no PNG baseline) — the pinned Linux Docker run is the CI gate.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

/**
 * The active cell's [data-row]/[data-col-index]/role read off the focused element, UNIFORM
 * across all six (incl. Lit shadow) via `getRootNode().activeElement`. Reused verbatim from
 * data-table-grid.spec.ts. Returns null when nothing inside the grid is focused.
 */
async function activeCellCoords(
  page: Page,
): Promise<{ row: string | null; col: string | null; role: string | null; ariaRowIndex: string | null } | null> {
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
    const row = cell ? cell.closest('[role="row"]') : null;
    return {
      row: cell ? cell.getAttribute('data-row') : null,
      col: cell ? cell.getAttribute('data-col-index') : null,
      role: cell ? cell.getAttribute('role') : null,
      ariaRowIndex: row ? row.getAttribute('aria-rowindex') : null,
    };
  });
}

/** The aria-rowindex attribute of every rendered body row, in DOM order (null when absent). */
async function bodyAriaRowIndices(page: Page): Promise<(string | null)[]> {
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
    if (!grid) return [];
    const tbody = grid.querySelector('tbody');
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('[role="row"]'))
      // Spacer rows (virtual mode) carry aria-hidden and no data cell — skip them.
      .filter((tr) => !tr.hasAttribute('aria-hidden'))
      .map((tr) => tr.getAttribute('aria-rowindex'));
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PAGINATED — DataTableGridAbsIndex (pageSize=3, 9 rows = 3 pages). The C1 reversal: an
// absolute focusCell(7) must switch to page 3 and report rowIndex 7 (not the page-relative 2).
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-absindex [${target}]: paginated focusCell is ABSOLUTE; getRowIndexRelativeToPage; aria-rowindex=abs+2`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridAbsIndex&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('grid-table');
    const gridTable = gridContainer.locator('table[role="grid"]');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    const pageStatus = gridContainer.locator('.rdt-page-status');
    const activeReadout = page.getByTestId('activecell-readout');
    const getActiveReadout = page.getByTestId('getactivecell-readout');
    const relReadout = page.getByTestId('relindex-readout');

    // Page 1 shows exactly 3 body rows with aria-rowindex 2/3/4 (B27 — header-inclusive, 1-based).
    await expect
      .poll(async () => (await pageStatus.textContent())?.trim() ?? '', { timeout: 15_000 })
      .toBe('Page 1 of 3');
    await expect
      .poll(async () => bodyAriaRowIndices(page), { timeout: 15_000 })
      .toEqual(['2', '3', '4']);

    // ── C1: focusCell(7, 1) — abs row 7 lives on page index 2 (floor(7/3)). The grid must
    //    SWITCH to page 3 then focus the abs-row-7 cell. (RED pre-fix: clamps page-relative
    //    to row 2 on page 1, reports '2,1', never advances the page.)
    await page.getByTestId('call-focuscell-page3').click();

    // The page advanced to 3 (the C1 absolute→page resolution).
    await expect
      .poll(async () => (await pageStatus.textContent())?.trim() ?? '', { timeout: 15_000 })
      .toBe('Page 3 of 3');
    // activecell-change carried the ABSOLUTE rowIndex 7 (not the page-relative 2).
    await expect
      .poll(async () => activeReadout.textContent(), { timeout: 15_000 })
      .toBe('7,1');
    // DOM focus landed on a real gridcell of the switched-in page, and that focused cell's
    // owning row is abs row 7 → aria-rowindex 9 (read BEFORE the handle buttons steal focus).
    await expect
      .poll(async () => (await activeCellCoords(page))?.role, { timeout: 15_000 })
      .toBe('gridcell');
    await expect
      .poll(async () => (await activeCellCoords(page))?.ariaRowIndex, { timeout: 15_000 })
      .toBe('9');

    // B27: page-3 rows carry ABSOLUTE aria-rowindex 8/9/10 (RED pre-fix: non-virtual rows have
    // NO aria-rowindex at all → null).
    await expect
      .poll(async () => bodyAriaRowIndices(page), { timeout: 15_000 })
      .toEqual(['8', '9', '10']);

    // getActiveCell() reads the same ABSOLUTE index pair back through the handle.
    await page.getByTestId('call-getactivecell').click();
    await expect
      .poll(async () => getActiveReadout.textContent(), { timeout: 15_000 })
      .toBe('7,1');

    // converter: getRowIndexRelativeToPage() → 7 - 2*3 = 1 (RED pre-fix: verb undefined → '').
    await page.getByTestId('call-relindex').click();
    await expect
      .poll(async () => relReadout.textContent(), { timeout: 15_000 })
      .toBe('1');

    // ── Absolute addressing holds over the SORTED display order: sort score desc, then
    //    focusCell(7) again — still page 3, still aria-rowindex 8/9/10 (the abs index tracks
    //    the filtered+sorted model, not source order).
    await page.getByTestId('call-sort-score').click();
    await page.getByTestId('call-focuscell-page3').click();
    await expect
      .poll(async () => (await pageStatus.textContent())?.trim() ?? '', { timeout: 15_000 })
      .toBe('Page 3 of 3');
    await expect
      .poll(async () => activeReadout.textContent(), { timeout: 15_000 })
      .toBe('7,1');
    await expect
      .poll(async () => bodyAriaRowIndices(page), { timeout: 15_000 })
      .toEqual(['8', '9', '10']);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// VIRTUAL — DataTableVirtualGrid (5,000 rows, windowing ON). The parity oracle: focusCell(4000)
// is already ABSOLUTE today; the same public contract + aria-rowindex=abs+2 must hold here too.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-absindex+virtual [${target}]: virtual focusCell is ABSOLUTE; aria-rowindex=abs+2`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtualGrid&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('grid-table');
    const gridTable = gridContainer.locator('table[role="grid"]');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 15_000 })
      .toBe('5000');

    const activeReadout = page.getByTestId('activecell-readout');
    const getActiveReadout = page.getByTestId('getactivecell-readout');

    // focusCell(4000, 1): the off-window scroll-then-focus path → abs rowIndex 4000.
    await page.getByTestId('call-focuscell-far').click();
    await expect
      .poll(async () => gridContainer.locator('[data-grid-cell][data-row="4000"]').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    // activecell-change carries the ABSOLUTE (full-model) index pair.
    await expect
      .poll(async () => activeReadout.textContent(), { timeout: 15_000 })
      .toBe('4000,1');
    // getActiveCell() reads the same absolute pair.
    await page.getByTestId('call-getactivecell').click();
    await expect
      .poll(async () => getActiveReadout.textContent(), { timeout: 15_000 })
      .toBe('4000,1');
    // B27 (virtual): the abs-row-4000 row carries aria-rowindex 4002.
    await expect
      .poll(
        async () =>
          gridContainer
            .locator('[role="row"]:has([data-grid-cell][data-row="4000"])')
            .first()
            .getAttribute('aria-rowindex'),
        { timeout: 15_000 },
      )
      .toBe('4002');
  });
}
