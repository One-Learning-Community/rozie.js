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

/** Wait until an editor element (piercing shadow roots) exists. */
async function waitForEditor(page: Page, selector: string): Promise<void> {
  await expect.poll(async () => inGrid<boolean>(page, `return !!findDeep(document, arg);`, selector), { timeout: 5_000 }).toBe(true);
}

async function rows(page: Page, field: keyof Row): Promise<unknown[]> {
  return (await modelRows(page)).map((r) => r[field]);
}

/** Open the active cell's built-in select editor and choose a value. */
async function chooseInSelect(page: Page, value: string): Promise<void> {
  await page.keyboard.press('Enter');
  await waitForEditor(page, 'select.rdt-cell-editor');
  // The editor takes focus a moment after it opens; keys pressed before that land on the cell.
  await expect.poll(async () => inGrid<string>(page, `
    const root = grid ? grid.getRootNode() : document;
    const a = root.activeElement;
    return a ? a.tagName.toLowerCase() : '';
  `), { timeout: 5_000 }).toBe('select');
  await page.locator('select.rdt-cell-editor').selectOption(value);
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

  runnerFor(target)(`data-table-range-fill [${target}]: R2 Ctrl+Enter in a built-in select fills the range`, async ({ page }) => {
    await gotoFill(page, target);
    await rangeDown(page, 0, 2, 3);
    await chooseInSelect(page, 'c');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect.poll(async () => JSON.stringify(await rows(page, 'city')), { timeout: 10_000 }).toBe(JSON.stringify(['c', 'c', 'c', 'c', 'c', 'c']));
    expect(await readout(page, 'commit-count')).toBe('4');
    expect(await announcement(page)).toContain('4 of 4 cells updated');
    await page.waitForTimeout(200);
    expect(await inRangeCount(page)).toBe(4);
  });

  runnerFor(target)(`data-table-range-fill [${target}]: R3 plain Enter commits the active cell only`, async ({ page }) => {
    await gotoFill(page, target);
    await rangeDown(page, 0, 2, 3);
    await chooseInSelect(page, 'c');
    await page.keyboard.press('Enter');
    await expect.poll(async () => JSON.stringify(await rows(page, 'city')), { timeout: 10_000 }).toBe(JSON.stringify(['a', 'a', 'b', 'c', 'c', 'c']));
    expect(await readout(page, 'commit-count')).toBe('1');
  });

  runnerFor(target)(`data-table-range-fill [${target}]: R4 a slot editor fills the range with its array value`, async ({ page }) => {
    await gotoFill(page, target);
    await rangeDown(page, 0, 3, 3);
    await page.keyboard.press('Enter');
    await waitForEditor(page, '[data-testid="tags-input"]');
    await expect(page.getByTestId('apply-hint')).toHaveText('Apply to 4 cells');
    await page.getByTestId('tags-input').fill('k,m');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect.poll(async () => JSON.stringify(await rows(page, 'tags')), { timeout: 10_000 })
      .toBe(JSON.stringify([['k', 'm'], ['k', 'm'], ['k', 'm'], ['k', 'm'], ['w'], []]));
    expect(await readout(page, 'commit-count')).toBe('4');
  });

  runnerFor(target)(`data-table-range-fill [${target}]: R5 commit(value, { toRange: true }) fills the range`, async ({ page }) => {
    await gotoFill(page, target);
    await rangeDown(page, 0, 3, 3);
    await page.keyboard.press('Enter');
    await waitForEditor(page, '[data-testid="tags-input"]');
    await page.getByTestId('tags-input').fill('n');
    await page.getByTestId('apply-all').click();
    await expect.poll(async () => JSON.stringify(await rows(page, 'tags')), { timeout: 10_000 })
      .toBe(JSON.stringify([['n'], ['n'], ['n'], ['n'], ['w'], []]));
  });

  runnerFor(target)(`data-table-range-fill [${target}]: R6 cells that fail validation are skipped and counted`, async ({ page }) => {
    await gotoFill(page, target);
    // Rows 2..5 of qty; row 3 is locked; the active cell is row 5.
    await rangeDown(page, 2, 1, 3);
    await page.keyboard.press('Enter');
    await waitForEditor(page, 'input.rdt-cell-editor');
    await page.locator('input.rdt-cell-editor').fill('-1');
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.waitForTimeout(300);
    // The active cell rejects -1: nothing is written and the editor stays open.
    expect(await rows(page, 'qty')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await readout(page, 'commit-count')).toBe('0');
    await page.locator('input.rdt-cell-editor').fill('7');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect.poll(async () => JSON.stringify(await rows(page, 'qty')), { timeout: 10_000 }).toBe(JSON.stringify([1, 2, 7, 4, 7, 7]));
    expect(await announcement(page)).toContain('3 of 4 cells updated');
  });

  runnerFor(target)(`data-table-range-fill [${target}]: R7 the whole fill is one undo step`, async ({ page }) => {
    await gotoFill(page, target);
    await rangeDown(page, 0, 2, 3);
    await chooseInSelect(page, 'c');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect.poll(async () => JSON.stringify(await rows(page, 'city')), { timeout: 10_000 }).toBe(JSON.stringify(['c', 'c', 'c', 'c', 'c', 'c']));
    await expect.poll(async () => activeCell(page), { timeout: 5_000 }).toBe('3,2');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => JSON.stringify(await rows(page, 'city')), { timeout: 10_000 }).toBe(JSON.stringify(['a', 'a', 'b', 'b', 'c', 'c']));
  });

  runnerFor(target)(`data-table-range-fill [${target}]: R8 Ctrl+Enter with no range commits one cell`, async ({ page }) => {
    await gotoFill(page, target);
    await focusCell(page, 4, 2);
    await chooseInSelect(page, 'a');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect.poll(async () => JSON.stringify(await rows(page, 'city')), { timeout: 10_000 }).toBe(JSON.stringify(['a', 'a', 'b', 'b', 'a', 'c']));
    expect(await readout(page, 'commit-count')).toBe('1');
  });

  runnerFor(target)(`data-table-range-fill [${target}]: R9 an editor that commits on blur writes one cell`, async ({ page }) => {
    await gotoFill(page, target);
    await rangeDown(page, 0, 4, 3);
    await page.keyboard.press('Enter');
    await waitForEditor(page, '[data-testid="defer-input"]');
    await page.getByTestId('defer-input').fill('zz');
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.waitForTimeout(100);
    await focusCell(page, 5, 0);
    await expect.poll(async () => JSON.stringify(await rows(page, 'defer')), { timeout: 10_000 }).toBe(JSON.stringify(['p', 'q', 'r', 'zz', 't', 'u']));
    expect(await readout(page, 'commit-count')).toBe('1');
  });

  runnerFor(target)(`data-table-range-fill [${target}]: R10 a two-column range fills only the active column`, async ({ page }) => {
    await gotoFill(page, target);
    await focusCell(page, 0, 1);
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => readout(page, 'range-readout'), { timeout: 10_000 }).toBe('1,2');
    await page.waitForTimeout(150);
    await chooseInSelect(page, 'c');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect.poll(async () => JSON.stringify(await rows(page, 'city')), { timeout: 10_000 }).toBe(JSON.stringify(['c', 'c', 'b', 'b', 'c', 'c']));
    expect(await rows(page, 'qty')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await readout(page, 'commit-count')).toBe('2');
  });
}
