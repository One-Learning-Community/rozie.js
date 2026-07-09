import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260709-3qt — grid-mode cell-interaction BATCH 2 (§6 drag-to-select, §7 Delete/Backspace
 * clear, §8 Ctrl+A / Ctrl+Arrow), RED-first behavioral (DOM-state) assertions.
 *
 * Drives `examples/demos/DataTableGridEditDemo.rozie` (?example=DataTableGridEdit — grid + six
 * editable columns 0..5 + a read-only `id` column at col 6 + a `singleClickEdit` toggle + a
 * `model-readout` <pre> of the bound data) across all six targets. Each assertion FAILS on the
 * pre-fix leaves (no drag path / no Delete-clear / no Ctrl-nav exists today) and PASSES after the
 * shared-source re-emit. Toggled-STATE assertions (`.rdt-in-range` counts, active-cell coords,
 * bound-model text), never snapshot-only. Columns: 0 name(text) 1 qty(number) 2 note(custom)
 * 3 active(checkbox) 4 verified(checkbox) 5 status(select) 6 id(READ-ONLY). 4 body rows.
 *
 *   §6 drag        — mousedown (0,0) → pointermove (1,1) → up ⇒ `.rdt-in-range` spans the 2×2
 *                    rectangle; a mousedown-with-no-move ⇒ 0 in-range + a single active cell.
 *   §7 clear       — a range (row 0 cols 0..6) + Delete ⇒ editable cells cleared, the read-only
 *                    `id` (col 6) unchanged; separately Backspace does the same.
 *   §8 Ctrl+A      — whole body range (`.rdt-in-range` count === rows × cols); page not selected.
 *   §8 Ctrl+Arrow  — Ctrl+ArrowDown jumps the active cell to the last row; Shift+Ctrl+ArrowDown
 *                    extends the range from the start row down to the last row.
 *
 * PER-TARGET activeElement / shadow reads: every DOM read walks open shadow roots so the Lit
 * target is covered uniformly. Helpers copied verbatim from data-table-grid-pointer.spec.ts.
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

/** Whether the body cell (row, col) inside a grid carries a given class (shadow-pierced).
 *  Copied from data-table-grid-pointer.spec.ts. */
async function cellHasClass(
  page: Page,
  testid: string,
  row: number,
  col: number,
  cls: string,
): Promise<boolean> {
  return page.evaluate(
    ({ id, r, c, k }) => {
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
      const findCell = (root: Document | ShadowRoot | Element): Element | null => {
        const sel = `[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`;
        const direct = (root as Element).querySelector
          ? (root as Element).querySelector(sel)
          : (root as Document).querySelector(sel);
        if (direct) return direct;
        const all = (root as Element).querySelectorAll
          ? (root as Element).querySelectorAll('*')
          : (root as Document).querySelectorAll('*');
        for (const el of Array.from(all)) {
          const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (shadow) {
            const inner = findCell(shadow);
            if (inner) return inner;
          }
        }
        return null;
      };
      const scope = findScope(document);
      if (!scope) return false;
      const cell = findCell(scope);
      return cell ? cell.classList.contains(k) : false;
    },
    { id: testid, r: row, c: col, k: cls },
  );
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

/** The bound-model rows as parsed JSON off the demo's `model-readout` <pre>. */
async function modelRows(
  page: Page,
): Promise<Array<Record<string, unknown>>> {
  const txt = await page.getByTestId('model-readout').first().textContent();
  try {
    return JSON.parse(txt || '[]');
  } catch {
    return [];
  }
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

/** A genuine mouse click on a body cell box by (row, col) — mousedown+focus+mouseup+click
 *  (walks open shadow roots). Optionally holds Shift. Copied from data-table-grid-pointer.spec.ts. */
async function clickBodyCell(page: Page, row: number, col: number, shift = false): Promise<void> {
  await page.evaluate(({ r, c, s }) => {
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
    if (cell) {
      const opts = { bubbles: true, shiftKey: s };
      cell.dispatchEvent(new MouseEvent('mousedown', opts));
      cell.focus();
      cell.dispatchEvent(new MouseEvent('mouseup', opts));
      cell.dispatchEvent(new MouseEvent('click', opts));
    }
  }, { r: row, c: col, s: shift });
}

/**
 * §6 drag-select: dispatch a real mousedown on the source cell (bubbles → onGridMouseDown →
 * beginRangeDrag), focus it (native focusin → active-cell sync), a document pointermove to the
 * target cell's center (→ cellIndexFromPoint → setRangeFocus paints the rectangle), then a
 * document pointerup (→ teardownRangeDrag). Coordinates come from getBoundingClientRect so it is
 * deterministic and cellIndexFromPoint's shadow-pierce covers Lit. Mirrors fillDragTo's discipline.
 */
async function dragSelect(page: Page, fromRow: number, fromCol: number, toRow: number, toCol: number): Promise<void> {
  await page.evaluate(({ fr, fc, tr, tc }) => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const inner = findGridTable(sr); if (inner) return inner; }
      }
      return null;
    };
    const grid = findGridTable(document);
    if (!grid) return;
    const src = grid.querySelector(`[data-grid-cell][data-row="${fr}"][data-col-index="${fc}"]`) as HTMLElement | null;
    const dst = grid.querySelector(`[data-grid-cell][data-row="${tr}"][data-col-index="${tc}"]`) as HTMLElement | null;
    if (!src || !dst) return;
    const srect = src.getBoundingClientRect();
    const drect = dst.getBoundingClientRect();
    const sx = srect.left + srect.width / 2;
    const sy = srect.top + srect.height / 2;
    const dx = drect.left + drect.width / 2;
    const dy = drect.top + drect.height / 2;
    src.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: sx, clientY: sy }));
    src.focus();
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: dx, clientY: dy }));
  }, { fr: fromRow, fc: fromCol, tr: toRow, tc: toCol });
  // Let setRangeFocus flush the moving corner (React setState is async).
  await page.waitForTimeout(200);
  await page.evaluate(({ tr, tc }) => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const inner = findGridTable(sr); if (inner) return inner; }
      }
      return null;
    };
    const grid = findGridTable(document);
    if (!grid) return;
    const dst = grid.querySelector(`[data-grid-cell][data-row="${tr}"][data-col-index="${tc}"]`) as HTMLElement | null;
    if (!dst) return;
    const r = dst.getBoundingClientRect();
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }, { tr: toRow, tc: toCol });
}

/** A mousedown-with-no-move on a body cell: mousedown + focus + pointerup, NO intervening
 *  pointermove → the drag never paints a range (collapses to a single active cell). */
async function mousedownNoMove(page: Page, row: number, col: number): Promise<void> {
  await page.evaluate(({ r, c }) => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const inner = findGridTable(sr); if (inner) return inner; }
      }
      return null;
    };
    const grid = findGridTable(document);
    if (!grid) return;
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`) as HTMLElement | null;
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy }));
    cell.focus();
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx, clientY: cy }));
  }, { r: row, c: col });
}

async function gotoGrid(page: Page, target: Target) {
  await page.goto(`/?example=DataTableGridEdit&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  const mount = page.getByTestId('rozie-mount');
  const gridTable = mount.getByTestId('grid-table').locator('table[role="grid"]');
  await expect(gridTable).toBeVisible({ timeout: 15_000 });
  return mount;
}

for (const target of TARGETS) {
  // ════════════════════════════════════════════════════════════════════════════════
  // §6 — DRAG paints a range: mousedown (0,0) → pointermove (1,1) → up ⇒ the covered 2×2
  //   rectangle gains `.rdt-in-range`. Pre-fix: onGridMouseDown ignores plain mousedown → RED.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-selection [${target}]: §6 drag across cells paints the range`, async ({ page }) => {
    await gotoGrid(page, target);
    await dragSelect(page, 0, 0, 1, 1);
    // The 2×2 rectangle (rows 0..1 × cols 0..1) is painted.
    await expect
      .poll(async () => countInRange(page, 'grid-table'), { timeout: 10_000 })
      .toBe(4);
    expect(await cellHasClass(page, 'grid-table', 1, 1, 'rdt-in-range')).toBe(true);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §6 — mousedown WITHOUT a move collapses to a single active cell (no range). Pre-fix: a
  //   plain mousedown was a no-op anyway; this pins the "no paint on a bare click" contract.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-selection [${target}]: §6 mousedown with no move leaves no range`, async ({ page }) => {
    await gotoGrid(page, target);
    await mousedownNoMove(page, 0, 0);
    await page.waitForTimeout(300);
    expect(await countInRange(page, 'grid-table')).toBe(0);
    // The single active cell is (0,0).
    await expect
      .poll(async () => { const a = await activeCellCoords(page); return a ? `${a.row},${a.col}` : null; }, { timeout: 10_000 })
      .toBe('0,0');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §7 — DELETE clears the editable cells of the selected range; the read-only `id` (col 6)
  //   is untouched. Range = row 0 cols 0..6 via click(0,0) + shift+click(0,6). Pre-fix: no
  //   Delete-clear branch → RED (the model is unchanged).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-selection [${target}]: §7 Delete clears editable cells, read-only untouched`, async ({ page }) => {
    await gotoGrid(page, target);
    expect((await modelRows(page))[0]?.name).toBe('Alpha');
    await clickBodyCell(page, 0, 0);
    await clickBodyCell(page, 0, 6, true); // shift+click → range row 0 cols 0..6
    await page.waitForTimeout(150);
    await page.keyboard.press('Delete');
    // The editable `name` cell (col 0) is cleared; the read-only `id` (col 6) is unchanged.
    await expect
      .poll(async () => (await modelRows(page))[0]?.name, { timeout: 10_000 })
      .toBe('');
    expect((await modelRows(page))[0]?.id).toBe(1);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §7 — BACKSPACE clears identically (separate keybinding onto the same clear funnel).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-selection [${target}]: §7 Backspace clears editable cells, read-only untouched`, async ({ page }) => {
    await gotoGrid(page, target);
    expect((await modelRows(page))[0]?.name).toBe('Alpha');
    await clickBodyCell(page, 0, 0);
    await clickBodyCell(page, 0, 6, true); // shift+click → range row 0 cols 0..6
    await page.waitForTimeout(150);
    await page.keyboard.press('Backspace');
    await expect
      .poll(async () => (await modelRows(page))[0]?.name, { timeout: 10_000 })
      .toBe('');
    expect((await modelRows(page))[0]?.id).toBe(1);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §8 — Ctrl+A selects the whole body range: `.rdt-in-range` spans EVERY body cell
  //   (4 rows × 7 cols = 28); the PAGE is not selected. Pre-fix: no Ctrl+A branch → RED.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-selection [${target}]: §8 Ctrl+A selects the whole body, not the page`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('Control+a');
    await expect
      .poll(async () => countInRange(page, 'grid-table'), { timeout: 10_000 })
      .toBe(28);
    // preventDefault kept the browser from selecting the page text.
    const pageSelection = await page.evaluate(() => (window.getSelection() ? window.getSelection()!.toString() : ''));
    expect(pageSelection).toBe('');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §8 — Ctrl+ArrowDown jumps the active cell to the data-region bottom edge (last row = 3).
  //   Pre-fix: no Ctrl+Arrow branch (plain ArrowDown steps one row) → RED.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-selection [${target}]: §8 Ctrl+ArrowDown jumps to the last row`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('Control+ArrowDown');
    await expect
      .poll(async () => { const a = await activeCellCoords(page); return a?.row; }, { timeout: 10_000 })
      .toBe('3');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §8 — Shift+Ctrl+ArrowDown EXTENDS the range from the start row down to the last row
  //   (col 0, rows 0..3 = 4 in-range cells). Pre-fix: no Ctrl+Arrow branch → RED.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-selection [${target}]: §8 Shift+Ctrl+ArrowDown extends the range to the last row`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('Control+Shift+ArrowDown');
    await expect
      .poll(async () => countInRange(page, 'grid-table'), { timeout: 10_000 })
      .toBe(4);
    expect(await cellHasClass(page, 'grid-table', 0, 0, 'rdt-in-range')).toBe(true);
    expect(await cellHasClass(page, 'grid-table', 3, 0, 'rdt-in-range')).toBe(true);
  });
}
