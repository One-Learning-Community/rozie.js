import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-10 (C4: RTL logical-nav contract) — the RTL contract PIN. Drives
 * `examples/demos/DataTableGridRtlDemo.rozie` (navigated `?example=DataTableGridRtl`, the
 * host appends the 'Demo' suffix) across all six targets and proves, INSIDE the real
 * DataTable.rozie with full table-core chrome, that grid arrow navigation stays LOGICAL
 * (index-based) under dir="rtl" — it does NOT physically flip just because the wrapper
 * renders right-to-left:
 *
 *   LOGICAL — from col 0, ArrowRight INCREMENTS data-col-index to 1 (NOT decrements, which a
 *             physical "follow the visual direction" mapping would do under rtl); ArrowLeft
 *             DECREMENTS. The column index is the model order, independent of the visual
 *             mirror the browser applies for dir=rtl.
 *   EDGES   — Home → col 0 (logical first column, index-addressed); End → last col
 *             (index = colCount-1). ArrowLeft at col 0 is a no-op (left edge clamp, logical).
 *   EMIT    — the @activecell-change emit carries the SAME logical colIndex (matches
 *             data-col-index), so a consumer addressing cells by index gets the same
 *             coordinate regardless of dir.
 *
 * CONTRACT PIN (C4 / SC-1): the grid nav (gridFocusNav.rzts moveCol / gridKeydownHandlers.rzts)
 * is purely index-based (clamp($data.activeColIndex ± delta)) with NO `dir`/`rtl` branch, so the
 * logical-nav contract holds BY CONSTRUCTION — NO source change was required (recorded in the
 * 63-10 SUMMARY). This spec is the canonical guard: a future emitter/source change that
 * introduced a physical flip under rtl would land RED here. DOM/behavioral, NOT screenshot
 * (the data-table-grid.spec.ts precedent — nav facts are exact DOM, not pixels).
 *
 * PER-TARGET activeElement READ (A1): the active cell is read through Lit's shadow root
 * uniformly via `getRootNode().activeElement` (document in the 5 light-DOM targets, the
 * shadow root inside Lit). The grid <table role="grid"> is found by walking all open shadow
 * roots (the data-table-grid.spec.ts helper, reused).
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
 * The active cell's coordinates read off the focused element UNIFORM across all six (incl.
 * Lit shadow) via getRootNode().activeElement. Returns null when nothing inside the grid is
 * focused.
 */
async function activeCellCoords(
  page: Page,
): Promise<{ row: string | null; col: string | null; role: string | null } | null> {
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
    };
  });
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-rtl [${target}]: arrow nav stays LOGICAL (index-based) under dir=rtl — no physical flip; Home/End index-addressed; emit carries logical colIndex`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridRtl&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('rtl-table');
    const gridTable = gridContainer.locator('table[role="grid"]');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    // Sanity: the wrapper IS rendered right-to-left (the visual mirror the contract is
    // robust against). The arrow nav below must NOT follow this physical direction.
    await expect(gridContainer).toHaveAttribute('dir', 'rtl');

    // Three columns → three columnheaders; the grid mounts with exactly one roving tab-stop.
    await expect
      .poll(async () => gridContainer.locator('[role="columnheader"]').count(), { timeout: 15_000 })
      .toBe(3);
    await expect
      .poll(async () => gridContainer.locator('[tabindex="0"]').count(), { timeout: 15_000 })
      .toBe(1);

    // Entry cell = first body data cell (row 0, col 0).
    const entry = gridContainer.locator('[tabindex="0"]').first();
    await expect(entry).toHaveAttribute('data-row', '0');
    await expect(entry).toHaveAttribute('data-col-index', '0');
    await entry.focus();
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');

    // ===================================================================
    // LOGICAL — ArrowRight INCREMENTS the column index (0 → 1), even though the visual
    //           order is mirrored under rtl. A physical-flip mapping would DECREMENT (and
    //           clamp at the left edge, leaving col 0). The increment is the contract.
    // ===================================================================
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
    // The @activecell-change emit carries the SAME logical colIndex (row 0, col 1).
    await expect
      .poll(async () => page.getByTestId('activecell-readout').textContent(), { timeout: 10_000 })
      .toBe('0,1');

    // ArrowRight again → col 2 (the last column, logical order).
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('2');

    // ArrowLeft DECREMENTS (2 → 1), the logical inverse — NOT an increment.
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');

    // ===================================================================
    // EDGES — Home → col 0 (index-addressed first column); End → last col (index 2). Both
    //         resolve by LOGICAL index, not by the visually-leading/trailing rtl column.
    // ===================================================================
    await page.keyboard.press('Home');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');
    // ArrowLeft at col 0 is a no-op (left edge clamp — logical, NOT a wrap to the last col).
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');
    await page.keyboard.press('End');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('2');
    // ArrowRight at the last col is a no-op (right edge clamp — logical, no wrap to col 0).
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('2');

    // The active cell stays a real gridcell on row 0 throughout (index-addressed nav, no
    // row drift from the horizontal moves).
    await expect
      .poll(async () => (await activeCellCoords(page))?.role, { timeout: 10_000 })
      .toBe('gridcell');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('0');
  });
}
