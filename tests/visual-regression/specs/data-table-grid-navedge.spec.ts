import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-4 — grid-mode NAV-EDGE behavioral battery (B6, B12). RED-first:
 * each assertion FAILS on the pre-fix build for the affected targets, then PASSES
 * after the shared-source fix (SC-1). Drives two fixtures across all six targets:
 *
 *   B6  (DataTableGridEmpty) — an empty / all-filtered grid must still expose EXACTLY
 *        ONE keyboard tab-stop (the roving tabindex falls back to a header cell) so the
 *        grid stays keyboard-reachable; filtering the body to zero rows must NOT leave
 *        the grid with ZERO tab-stops (a keyboard trap). Clearing the filter back to a
 *        non-empty model recovers a valid BODY active cell + single tab-stop.
 *        Pre-fix: cellTabindex yields ZERO tab-stops when bodyRowCount===0 (the active
 *        key String(activeRow) matches no header cell and no body cell exists).
 *
 *   B12 (DataTableGridGroupedHeader) — a grouped MULTI-LEVEL column header must preserve
 *        the roving single-tab-stop invariant (exactly ONE tabindex=0 across the parent
 *        header row + the leaf header row + the body — never multiple), and ArrowUp from
 *        a leaf header must resolve to the CORRECT PARENT header (the one spanning that
 *        leaf), with ArrowDown returning to the matching leaf / body cell.
 *        Pre-fix: cellTabindex is level-blind → the parent (level 0, colIndex 0) AND the
 *        leaf (level 1, colIndex 0) BOTH carry tabindex=0 (multiple tab-stops), and a
 *        cross-up from the body resolves resolveCellEl('__header', 0) to the FIRST DOM
 *        match (the parent), skipping the leaf; ArrowUp from a header is then a no-op.
 *
 * PER-TARGET activeElement READ (pinned by phase-49 plan 01): focus is read through
 * Lit's shadow root uniformly via `gridRoot.getRootNode().activeElement` — in the 5
 * light-DOM targets getRootNode() is `document`; inside Lit's open shadow root it is the
 * shadow root whose activeElement is the focused cell. Reused from data-table-grid.spec.ts.
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
 * The focused grid cell's coordinates, read off the focused element UNIFORM across all
 * six (incl. Lit shadow) via `getRootNode().activeElement`. Returns null when nothing
 * inside the grid is focused. Extends the data-table-grid.spec helper with the
 * `data-header-level` coordinate (B12 — the header-row level of the active cell).
 */
async function gridCellInfo(
  page: Page,
): Promise<{ row: string | null; col: string | null; role: string | null; level: string | null; tag: string } | null> {
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
    return {
      row: cell ? cell.getAttribute('data-row') : null,
      col: cell ? cell.getAttribute('data-col-index') : null,
      role: cell ? cell.getAttribute('role') : null,
      level: cell ? cell.getAttribute('data-header-level') : null,
      tag: active.tagName.toLowerCase(),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// B6 — empty / all-filtered grid keeps a single keyboard tab-stop + recovers on clear.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-navedge B6 [${target}]: empty/all-filtered grid keeps exactly one tab-stop (header fallback) + recovers`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridEmpty&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('grid-table');
    const gridTable = gridContainer.locator('table[role="grid"]');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    const tabStops = gridContainer.locator('[tabindex="0"]');

    // Baseline: a non-empty grid has exactly ONE roving tab-stop on the entry body cell.
    await expect.poll(async () => tabStops.count(), { timeout: 15_000 }).toBe(1);
    await expect(tabStops.first()).toHaveAttribute('data-row', '0');
    await expect(tabStops.first()).toHaveAttribute('role', 'gridcell');
    // 3 body rows initially.
    await expect
      .poll(async () => gridContainer.locator('tbody [role="row"]').count(), { timeout: 10_000 })
      .toBe(3);

    // ── B6 core: filter the body down to ZERO rows via the bound global filter. ──
    await page.getByTestId('filter-empty').click();
    await expect
      .poll(async () => gridContainer.locator('tbody [role="row"]').count(), { timeout: 10_000 })
      .toBe(0);

    // The grid is NOT a keyboard trap: exactly ONE tab-stop remains — and it is a HEADER
    // cell (the roving tabindex fell back to the header so the grid stays reachable).
    // RED on the pre-fix build: bodyRowCount===0 → cellTabindex returns -1 everywhere → 0.
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);
    await expect(tabStops.first()).toHaveAttribute('role', 'columnheader');
    await expect(tabStops.first()).toHaveAttribute('data-row', '__header');

    // Tab from OUTSIDE lands on the fallback header tab-stop (keyboard-reachable, focus is
    // NOT lost into <body>). Focus the global-filter input, then Tab into the grid.
    await page.getByTestId('global-filter').focus();
    await page.keyboard.press('Tab');
    await expect
      .poll(async () => (await gridCellInfo(page))?.role, { timeout: 10_000 })
      .toBe('columnheader');

    // ── B6 recovery: clear the filter → the body model returns; a valid BODY active cell
    //    + single tab-stop recovers (the roving tabindex is re-seated onto a real cell). ──
    await page.getByTestId('clear-filter').click();
    await expect
      .poll(async () => gridContainer.locator('tbody [role="row"]').count(), { timeout: 10_000 })
      .toBe(3);
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);
    await expect
      .poll(async () => tabStops.first().getAttribute('role'), { timeout: 10_000 })
      .toBe('gridcell');
    await expect
      .poll(async () => tabStops.first().getAttribute('data-row'), { timeout: 10_000 })
      .toBe('0');
    // The recovered tab-stop addresses a REAL cell.
    await expect
      .poll(async () => {
        const r = await tabStops.first().getAttribute('data-row');
        const c = await tabStops.first().getAttribute('data-col-index');
        return gridContainer
          .locator(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`)
          .count();
      }, { timeout: 10_000 })
      .toBe(1);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// B12 — grouped multi-level header preserves the roving invariant + correct ArrowUp.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-navedge B12 [${target}]: grouped multi-level header keeps one tab-stop + ArrowUp resolves the correct parent`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridGroupedHeader&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('grid-table');
    const gridTable = gridContainer.locator('table[role="grid"]');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    // TWO header-row levels render (the grouped-header form): a parent row + a leaf row.
    await expect
      .poll(async () => gridContainer.locator('thead tr').count(), { timeout: 15_000 })
      .toBe(2);
    // 6 columnheaders total: parent [Identity, Metrics] + leaf [Name, City, Qty, Cost].
    await expect
      .poll(async () => gridContainer.locator('[role="columnheader"]').count(), { timeout: 10_000 })
      .toBe(6);

    const tabStops = gridContainer.locator('[tabindex="0"]');

    // Baseline: exactly ONE roving tab-stop on the entry body cell (0,0) — the grouped
    // header does NOT introduce a second tab-stop.
    await expect.poll(async () => tabStops.count(), { timeout: 15_000 }).toBe(1);
    const entry = tabStops.first();
    await expect(entry).toHaveAttribute('data-row', '0');
    await expect(entry).toHaveAttribute('data-col-index', '0');
    await expect(entry).toHaveAttribute('role', 'gridcell');

    await entry.focus();
    await expect
      .poll(async () => (await gridCellInfo(page))?.col, { timeout: 10_000 })
      .toBe('0');

    // ── ArrowUp from body row 0 → the LEAF header (the row adjacent to the body), NOT the
    //    parent. The leaf header is level 1, the 'Name' column (data-col-index 0). ──
    // RED: pre-fix resolves resolveCellEl('__header', 0) to the FIRST DOM match (the parent
    //      'Identity', level 0) AND the level-blind cellTabindex lights TWO tab-stops.
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await gridCellInfo(page))?.role, { timeout: 10_000 })
      .toBe('columnheader');
    await expect
      .poll(async () => (await gridCellInfo(page))?.level, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => (await gridCellInfo(page))?.col, { timeout: 10_000 })
      .toBe('0');
    // The roving single-tab-stop invariant holds across BOTH header levels + the body.
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);
    await expect(tabStops.first()).toHaveAttribute('data-header-level', '1');

    // ── ArrowUp again → the CORRECT PARENT header spanning the active leaf: 'Identity'
    //    (level 0, data-col-index 0) — the parent of the 'Name' leaf, not 'Metrics'. ──
    // RED: pre-fix ArrowUp from a header is a no-op (moveRow returns unchanged).
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await gridCellInfo(page))?.level, { timeout: 10_000 })
      .toBe('0');
    await expect
      .poll(async () => (await gridCellInfo(page))?.col, { timeout: 10_000 })
      .toBe('0');
    await expect
      .poll(async () => (await gridCellInfo(page))?.role, { timeout: 10_000 })
      .toBe('columnheader');
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);
    await expect(tabStops.first()).toHaveAttribute('data-header-level', '0');

    // ── ArrowDown → back to the matching LEAF header (level 1, the first child of the
    //    'Identity' parent = 'Name', data-col-index 0). ──
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => (await gridCellInfo(page))?.level, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => (await gridCellInfo(page))?.col, { timeout: 10_000 })
      .toBe('0');
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);

    // ── ArrowDown → back into the body (row 0, gridcell). ──
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => (await gridCellInfo(page))?.role, { timeout: 10_000 })
      .toBe('gridcell');
    await expect
      .poll(async () => (await gridCellInfo(page))?.row, { timeout: 10_000 })
      .toBe('0');
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);

    // ── Cross into a DIFFERENT group: nav to a leaf under 'Metrics' (Qty, col 2), ArrowUp
    //    must resolve to 'Metrics' (parent level 0, data-col-index 1), not 'Identity'. ──
    await page.keyboard.press('ArrowRight'); // col 1 (City)
    await page.keyboard.press('ArrowRight'); // col 2 (Qty)
    await expect
      .poll(async () => (await gridCellInfo(page))?.col, { timeout: 10_000 })
      .toBe('2');
    await page.keyboard.press('ArrowUp'); // → leaf header Qty (level 1, col 2)
    await expect
      .poll(async () => (await gridCellInfo(page))?.level, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => (await gridCellInfo(page))?.col, { timeout: 10_000 })
      .toBe('2');
    await page.keyboard.press('ArrowUp'); // → parent header Metrics (level 0, col 1)
    await expect
      .poll(async () => (await gridCellInfo(page))?.level, { timeout: 10_000 })
      .toBe('0');
    await expect
      .poll(async () => (await gridCellInfo(page))?.col, { timeout: 10_000 })
      .toBe('1');
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);
  });
}
