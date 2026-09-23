import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260922-mkb — B-15, RED-first. The APG grid pattern's selection keys were all absent:
 *
 *   Shift+Space — select the ROW containing the focused cell (the row-selection MODEL, read
 *                 off the demo's bound `r-model:rowSelection` readout — not checkbox paint)
 *   Ctrl+Space  — select the COLUMN containing the focused cell, as a full-height CELL range
 *                 (the same corners Ctrl+A and shift+arrow drive)
 *   Escape      — in NAVIGATION mode, collapse an active range
 *
 * Drives examples/demos/DataTableGridKeysDemo.rozie (?example=DataTableGridKeys): grid mode,
 * selectionMode='multiple' (col 0 = the select rail), three text columns, 4 body rows.
 * Each case is RED on the pre-fix leaves: Shift+Space and Ctrl+Space fall through to the bare
 * `' '` branches (no selection change); Escape in navigation mode was a no-op.
 * Helpers copied verbatim from data-table-grid-selection.spec.ts (shadow-pierced for Lit).
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
 * across all six (incl. Lit shadow) via `getRootNode().activeElement`. Null when nothing
 * inside the grid is focused. Copied from data-table-grid-pointer.spec.ts.
 */
async function activeCellCoords(
  page: Page,
): Promise<{ row: string | null; col: string | null; role: string | null; tag: string } | null> {
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
      tag: active.tagName.toLowerCase(),
    };
  });
}

/** Count the `.rdt-in-range` body cells rendered in a grid scope (shadow-pierced). */
async function countInRange(page: Page, testid: string): Promise<number> {
  return page.evaluate((id) => {
    const findScope = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(`[data-testid="${id}"]`);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findScope(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    let count = 0;
    const collect = (root: Element | ShadowRoot): void => {
      const cells = root.querySelectorAll('[data-grid-cell].rdt-in-range');
      count += cells.length;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (shadow) collect(shadow);
      }
    };
    const scope = findScope(document);
    if (!scope) return -1;
    collect(scope);
    return count;
  }, testid);
}

/** Focus a body cell directly by (row, col) — drives @focusin → activeRow/activeColIndex sync.
 *  Walks open shadow roots (Lit). Copied from data-table-grid-pointer.spec.ts. */
async function focusBodyCell(page: Page, row: number, col: number): Promise<void> {
  await page.evaluate(({ r, c }) => {
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
    if (!grid) return;
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`) as HTMLElement | null;
    if (cell) cell.focus();
  }, { r: row, c: col });
}

/** Focus (row, col) and KEEP it focused until the active cell settles there AND HOLDS across a
 *  stability window. Copied from data-table-grid-pointer.spec.ts. */
async function focusBodyCellStable(page: Page, row: number, col: number): Promise<void> {
  await focusBodyCell(page, row, col);
  let stableHits = 0;
  await expect
    .poll(
      async () => {
        const a = await activeCellCoords(page);
        if (a?.row === String(row) && a?.col === String(col)) {
          stableHits += 1;
        } else {
          stableHits = 0;
          await focusBodyCell(page, row, col);
        }
        return stableHits;
      },
      { timeout: 5_000, intervals: [40, 40, 40, 60, 100] },
    )
    .toBeGreaterThanOrEqual(2);
}

async function gotoGrid(page: Page, target: Target) {
  await page.goto(`/?example=DataTableGridKeys&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  const mount = page.getByTestId('rozie-mount');
  const gridTable = mount.getByTestId('grid-table').locator('table[role="grid"]');
  await expect(gridTable).toBeVisible({ timeout: 15_000 });
  return mount;
}

const readout = async (page: Page, id: string): Promise<string> =>
  ((await page.getByTestId(id).first().textContent()) || '').trim();

for (const target of TARGETS) {
  // Shift+Space on body row 2 selects that row in the MODEL, and only that row.
  runnerFor(target)(`data-table-grid-keys [${target}]: B-15 Shift+Space selects the focused row`, async ({ page }) => {
    await gotoGrid(page, target);
    expect(await readout(page, 'selection-readout')).toBe('');
    await focusBodyCellStable(page, 2, 1);
    await page.keyboard.press('Shift+Space');
    await expect.poll(async () => readout(page, 'selection-readout'), { timeout: 10_000 }).toBe('2');
    // A second Shift+Space toggles it back off (the checkbox funnel's own semantics).
    await page.keyboard.press('Shift+Space');
    await expect.poll(async () => readout(page, 'selection-readout'), { timeout: 10_000 }).toBe('');
  });

  // Ctrl+Space on (1, 2) selects the whole column as a cell range: 4 rows x 1 column.
  runnerFor(target)(`data-table-grid-keys [${target}]: B-15 Ctrl+Space selects the focused column as a range`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 1, 2);
    await page.keyboard.press('Control+Space');
    await expect.poll(async () => countInRange(page, 'grid-table'), { timeout: 10_000 }).toBe(4);
    expect(await readout(page, 'range-readout')).toBe('0,2-3,2');
    // Row selection is untouched — Ctrl+Space is a CELL range, not a row select.
    expect(await readout(page, 'selection-readout')).toBe('');
  });

  // Escape in navigation mode collapses a shift-arrowed range; the active cell stays put.
  runnerFor(target)(`data-table-grid-keys [${target}]: B-15 Escape collapses the range in navigation mode`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 1);
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => countInRange(page, 'grid-table'), { timeout: 10_000 }).toBe(2);
    await page.keyboard.press('Escape');
    await expect.poll(async () => countInRange(page, 'grid-table'), { timeout: 10_000 }).toBe(0);
    const a = await activeCellCoords(page);
    expect([a?.row, a?.col]).toEqual(['1', '1']);
  });
}
