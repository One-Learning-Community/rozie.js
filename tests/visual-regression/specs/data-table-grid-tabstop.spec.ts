import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260922-mkb — the roving tab stop survives windowing, RED-first.
 *
 * The active cell is the grid's ONLY `tabindex="0"` (every other cell is -1). Two paths left a
 * windowed grid with NO tab stop — Tab could not re-enter it — while the roving model pointed at
 * a cell with no DOM node:
 *
 *   B-06 — row axis: scrolling the viewport carried the active ROW out of the row window and it
 *          was recycled (only the EDITING row was pinned in the window).
 *   B-03 — column axis, HEADER cells: End on a leaf header moved the model to an off-window
 *          column, but the header path neither scrolled it in nor forced its column into the
 *          window, so focus froze on the old <th> and no rendered cell carried tabindex="0".
 *
 * Asserted on the DOM: exactly one tabindex="0" cell exists, and it is the active cell.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return built ? test : test.fixme;
}

/** Every grid cell with tabindex="0" in the first grid table, as "row,col" (shadow-pierced). */
async function tabStops(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const findGrid = (root: Document | ShadowRoot): Element | null => {
      const d = root.querySelector('table[role="grid"]');
      if (d) return d;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const f = findGrid(sr); if (f) return f; }
      }
      return null;
    };
    const grid = findGrid(document);
    if (!grid) return ['NO-GRID'];
    return Array.from(grid.querySelectorAll('[data-grid-cell][tabindex="0"]')).map(
      (c) => c.getAttribute('data-row') + ',' + c.getAttribute('data-col-index'),
    );
  });
}

/** "row,col" of the focused grid cell, or null. */
async function focusedCell(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const findGrid = (root: Document | ShadowRoot): Element | null => {
      const d = root.querySelector('table[role="grid"]');
      if (d) return d;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const f = findGrid(sr); if (f) return f; }
      }
      return null;
    };
    const grid = findGrid(document);
    if (!grid) return null;
    const ae = (grid.getRootNode() as Document | ShadowRoot).activeElement;
    const cell = ae && ae.closest ? ae.closest('[data-grid-cell]') : null;
    return cell && grid.contains(cell) ? cell.getAttribute('data-row') + ',' + cell.getAttribute('data-col-index') : null;
  });
}

/** Focus the first grid's cell matching `selector` and wait for it to hold focus. */
async function focusGridCell(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const findGrid = (root: Document | ShadowRoot): Element | null => {
      const d = root.querySelector('table[role="grid"]');
      if (d) return d;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const f = findGrid(sr); if (f) return f; }
      }
      return null;
    };
    (findGrid(document)?.querySelector(sel) as HTMLElement | null)?.focus();
  }, selector);
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-tabstop [${target}]: B-06 the active row stays rendered when the viewport scrolls it away`, async ({ page }) => {
    await page.goto(`/?example=DataTableVirtualGrid&target=${target}`);
    await expect(page.getByTestId('rozie-mount').locator('table[role="grid"]').first()).toBeVisible({ timeout: 15_000 });
    await focusGridCell(page, '[data-grid-cell][data-row="0"][data-col-index="0"]');
    await expect.poll(async () => focusedCell(page), { timeout: 5_000 }).toBe('0,0');

    // Scroll the row window far past row 0, without touching the keyboard.
    await page.evaluate(() => {
      const deep = (sel: string, root: Document | ShadowRoot = document): HTMLElement | null => {
        const d = root.querySelector(sel) as HTMLElement | null;
        if (d) return d;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) { const f = deep(sel, sr); if (f) return f; }
        }
        return null;
      };
      const sc = deep('.rdt-scroll');
      if (sc) sc.scrollTop = 60_000;
    });
    // Wait for the far rows to render, then for any recycle to settle.
    await expect.poll(async () => (await tabStops(page)).length >= 0 && page.evaluate(() => document.body.innerHTML.length), { timeout: 5_000 }).toBeTruthy();
    await page.waitForTimeout(500);

    // Exactly one tab stop, and it is still the active cell.
    await expect.poll(async () => tabStops(page), { timeout: 5_000 }).toEqual(['0,0']);
  });

  runnerFor(target)(`data-table-grid-tabstop [${target}]: B-03 End on a leaf header reaches an off-window column and keeps the tab stop`, async ({ page }) => {
    await page.goto(`/?example=DataTableColumnVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount').locator('table[role="grid"]').first()).toBeVisible({ timeout: 15_000 });
    // A LEAF header cell, column 1. The thead is: group-header row, LEAF row, filter row.
    await focusGridCell(page, 'thead tr:nth-child(2) [data-grid-cell][data-col-index="1"]');
    await expect.poll(async () => focusedCell(page), { timeout: 5_000 }).toMatch(/,1$/);
    const headerRow = ((await focusedCell(page)) || '').split(',')[0];

    await page.keyboard.press('End');
    // Focus lands on the LAST header cell of that row (col 59 of 60)...
    await expect.poll(async () => focusedCell(page), { timeout: 10_000 }).toBe(`${headerRow},59`);
    // ...and it is the grid's one and only tab stop.
    await expect.poll(async () => tabStops(page), { timeout: 5_000 }).toEqual([`${headerRow},59`]);
  });
}
