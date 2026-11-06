import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Range fill (examples/demos/DataTableRangeFillDemo.rozie, ?example=DataTableRangeFill).
 * Select a block of cells in one column, open the editor, and Ctrl/Cmd+Enter writes the
 * editor's value to every selected cell in the active cell's column.
 *
 *   R1  — the range stays selected while the editor is open (built-in and slot editors).
 *   R2  — built-in select: Ctrl+Enter fills the range; one commit per changed cell; the
 *         announcement reads "N of M cells updated"; the range stays selected.
 *   R3  — plain Enter commits the active cell only.
 *   R4  — slot editor with an array value: scope.rangeSize drives the hint, and Ctrl+Enter
 *         writes the same array (not a string) to every cell.
 *   R5  — scope.commit(value, { toRange: true }) fills the range from a button.
 *   R6  — cells that fail validation are skipped and counted ("3 of 4").
 *   R7  — the whole fill is one undo step.
 *   R8  — Ctrl+Enter with no range commits the single cell once.
 *   R9  — an editor that only commits on blur writes the active cell only.
 *   R10 — a range across two columns fills only the active cell's column.
 *   R11 — Space on a checkbox range sets every cell to the opposite of the active cell.
 *
 * Column indices: 0 label, 1 qty, 2 city, 3 tags, 4 defer, 5 done. Row 3 is locked.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

interface Row { id: number; label: string; qty: unknown; city: string; tags: unknown; defer: string; done: boolean; locked: boolean }

/** Shared in-page helper source: finds the grid table, piercing shadow roots. */
const FIND_GRID = `
  const findGridTable = (root) => {
    const direct = root.querySelector('table[role="grid"]');
    if (direct) return direct;
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const sr = el.shadowRoot;
      if (sr) { const inner = findGridTable(sr); if (inner) return inner; }
    }
    return null;
  };
  const findDeep = (root, sel) => {
    const direct = root.querySelector(sel);
    if (direct) return direct;
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const sr = el.shadowRoot;
      if (sr) { const inner = findDeep(sr, sel); if (inner) return inner; }
    }
    return null;
  };
`;

async function inGrid<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(
    ({ src, a }) => {
      // eslint-disable-next-line no-new-func
      return new Function('arg', src)(a);
    },
    { src: `${FIND_GRID}\nconst grid = findGridTable(document);\n${body}`, a: arg },
  ) as Promise<T>;
}

async function readout(page: Page, testid: string): Promise<string> {
  return ((await page.getByTestId(testid).textContent()) ?? '').trim();
}

async function modelRows(page: Page): Promise<Row[]> {
  try { return JSON.parse(await readout(page, 'model-readout')) as Row[]; } catch { return []; }
}

async function activeCell(page: Page): Promise<string> {
  return inGrid<string>(page, `
    if (!grid) return '';
    const root = grid.getRootNode();
    const a = root.activeElement;
    const cell = a ? a.closest('[data-grid-cell]') : null;
    return cell ? cell.getAttribute('data-row') + ',' + cell.getAttribute('data-col-index') : '';
  `);
}

async function focusCell(page: Page, row: number, col: number): Promise<void> {
  await inGrid(page, `
    const c = grid && grid.querySelector('[data-grid-cell][data-row="' + arg.r + '"][data-col-index="' + arg.c + '"]');
    if (c) c.focus();
  `, { r: row, c: col });
  await expect.poll(async () => activeCell(page), { timeout: 5_000 }).toBe(`${row},${col}`);
}

async function inRangeCount(page: Page): Promise<number> {
  return inGrid<number>(page, `return grid ? grid.querySelectorAll('td.rdt-in-range').length : -1;`);
}

/** The aria-live announcement text (the sr-live region sits beside the grid table). */
async function announcement(page: Page): Promise<string> {
  return inGrid<string>(page, `
    if (!grid) return '';
    const root = grid.getRootNode();
    return Array.from(root.querySelectorAll('.rdt-sr-live')).map((n) => n.textContent || '').join(' | ');
  `);
}

/** Focus an element inside the editing cell by test id (slot editors focus on demand). */
async function focusEditor(page: Page, testid: string): Promise<void> {
  await inGrid(page, `
    const el = findDeep(document, '[data-testid="' + arg + '"]');
    if (el) el.focus();
  `, testid);
}

/** Build a vertical range from (row,col) down `steps` rows; waits for range-change. */
async function rangeDown(page: Page, row: number, col: number, steps: number): Promise<void> {
  await focusCell(page, row, col);
  for (let i = 0; i < steps; i++) await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(async () => readout(page, 'range-readout'), { timeout: 10_000 }).toBe(`${row + steps},${col}`);
  await expect.poll(async () => inRangeCount(page), { timeout: 5_000 }).toBe(steps + 1);
  // React commits its internal range state a tick after the event (ROZ138).
  await page.waitForTimeout(150);
}

async function gotoFill(page: Page, target: Target) {
  await page.goto(`/?example=DataTableRangeFill&target=${target}`);
  const mount = page.getByTestId('rozie-mount');
  await expect(mount).toBeVisible();
  await expect(mount.getByTestId('grid-table').locator('table[role="grid"]')).toBeVisible({ timeout: 15_000 });
  return mount;
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table-range-fill [${target}]: R1 range survives opening a built-in editor`, async ({ page }) => {
    await gotoFill(page, target);
    await rangeDown(page, 0, 1, 3);
    const nullsBefore = await readout(page, 'range-null-count');
    await page.keyboard.press('Enter');
    await expect.poll(async () => inGrid<boolean>(page, `return !!(grid && grid.querySelector('input.rdt-cell-editor'));`), { timeout: 5_000 }).toBe(true);
    await page.waitForTimeout(200);
    expect(await inRangeCount(page)).toBe(4);
    expect(await readout(page, 'range-null-count')).toBe(nullsBefore);
  });

  runnerFor(target)(`data-table-range-fill [${target}]: R1 range survives focusing a slot editor`, async ({ page }) => {
    await gotoFill(page, target);
    await rangeDown(page, 0, 3, 3);
    const nullsBefore = await readout(page, 'range-null-count');
    await page.keyboard.press('Enter');
    await expect.poll(async () => inGrid<boolean>(page, `return !!findDeep(document, '[data-testid="tags-input"]');`), { timeout: 5_000 }).toBe(true);
    await focusEditor(page, 'tags-input');
    await page.waitForTimeout(200);
    expect(await inRangeCount(page)).toBe(4);
    expect(await readout(page, 'range-null-count')).toBe(nullsBefore);
  });
}
