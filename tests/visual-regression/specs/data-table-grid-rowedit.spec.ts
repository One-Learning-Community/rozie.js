import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-2 — the row-mode-edit + commit-under-sort behavioral battery (B21, B22,
 * B23), RED-first. Drives `examples/demos/DataTableGridRowEditDemo.rozie`
 * (?example=DataTableGridRowEdit) across all six targets. Each assertion FAILS on the
 * pre-fix build for the affected targets and PASSES after the shared-source fix is
 * re-emitted (SC-1).
 *
 *   B21 — in full-row edit, Tab off the LAST editable cell stays CONTAINED inside the
 *         editing row (cycles to the first editor) instead of escaping the row and
 *         freezing grid nav; after the row exits, grid nav still works.
 *   B22 — a row-mode validation failure focuses the OFFENDING column's editor (the one
 *         whose validator rejected), not unconditionally the first editor.
 *   B23 — a single-cell commit under an ACTIVE sort relocates the row; DOM focus FOLLOWS
 *         the committed row to its NEW display index (not stranded on the old index / body).
 *
 * Helpers (activeCellCoords / openEditor / focusedTag / readout / shadow-pierced finds)
 * are copied verbatim from data-table-grid-edit.spec.ts / data-table-edit.spec.ts.
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
 * The active cell's [data-row]/[data-col-index]/role read off the focused element,
 * UNIFORM across all six (incl. Lit shadow) via `getRootNode().activeElement`. Returns
 * null when nothing inside the grid is focused. Copied from data-table-grid-edit.spec.ts.
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

/**
 * The open editor element ([data-editing-cell]) descriptor — its tag, value, and the
 * owning cell's [data-col-index]/[data-row]. Null when no editor is open. In ROW mode
 * multiple editors are open at once; this returns the FIRST in DOM order. Walks open
 * shadow roots (Lit).
 */
async function openEditor(
  page: Page,
): Promise<{ tag: string; value: string; col: string | null; row: string | null } | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[data-editing-cell]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = find(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const el = find(document) as HTMLInputElement | null;
    if (!el) return null;
    const cell = el.closest('[data-grid-cell]');
    return {
      tag: el.tagName.toLowerCase(),
      value: el.value != null ? String(el.value) : '',
      col: cell ? cell.getAttribute('data-col-index') : null,
      row: cell ? cell.getAttribute('data-row') : null,
    };
  });
}

/** The number of OPEN editors ([data-editing-cell]) anywhere in the grid (shadow-pierced).
 *  In full-row edit this is the count of editable cells in the editing row. */
async function editorCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    let n = 0;
    const walk = (root: Document | ShadowRoot): void => {
      n += root.querySelectorAll('[data-editing-cell]').length;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walk(sr);
      }
    };
    walk(document);
    return n;
  });
}

/** The deepest shadow-pierced active element's tagName. Copied from data-table-edit.spec.ts. */
async function focusedTag(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    let active: Element | null = document.activeElement;
    while (active && (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
      const sr = (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot as ShadowRoot;
      if (!sr.activeElement) break;
      active = sr.activeElement;
    }
    return active ? active.tagName.toLowerCase() : null;
  });
}

/** Focus the [data-editing-cell] editor inside the cell at (row, col) (shadow-pierced). */
async function focusRowEditorAt(page: Page, row: number, col: number): Promise<void> {
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
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`);
    const ed = cell ? (cell.querySelector('[data-editing-cell]') as HTMLElement | null) : null;
    if (ed) ed.focus();
  }, { r: row, c: col });
}

/** Set the [data-editing-cell] editor value inside cell (row, col) + fire `input` (shadow-pierced). */
async function fillRowEditor(page: Page, row: number, col: number, value: string): Promise<void> {
  await page.evaluate(({ r, c, v }) => {
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
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`);
    const ed = cell ? (cell.querySelector('[data-editing-cell]') as HTMLInputElement | null) : null;
    if (ed) {
      ed.focus();
      ed.value = v;
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, { r: row, c: col, v: value });
}

/** The #cell display text at the grid cell (row, col) (shadow-pierced). '' when absent. */
async function cellText(page: Page, row: number, col: number): Promise<string> {
  return page.evaluate(({ r, c }) => {
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
    if (!grid) return '';
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`);
    return cell ? (cell.textContent || '').trim() : '';
  }, { r: row, c: col });
}

/** Read a readout testid's trimmed text (shadow-pierced), '' when absent. */
async function readoutText(page: Page, testid: string): Promise<string> {
  return page.evaluate((id) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(`[data-testid="${id}"]`);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = find(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const el = find(document);
    return el ? (el.textContent || '').trim() : '';
  }, testid);
}

/** The committed model (JSON.parsed from the model-readout dump). */
async function modelRows(
  page: Page,
): Promise<Array<{ id: number; name: string; qty: unknown; status: string; city: string }>> {
  const raw = await readoutText(page, 'model-readout');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Focus a body cell directly by (row, col) — drives @focusin → activeRow/activeColIndex sync. */
async function focusBodyCell(page: Page, row: number, col: number): Promise<void> {
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
    if (cell) cell.focus();
  }, { r: row, c: col });
}

/** Focus (row, col) and KEEP it focused until the active cell settles there AND holds. Copied
 *  from data-table-edit.spec.ts. */
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

/** Settle the grid, focus (row, col), press F2 to open its single-cell editor. Copied from
 *  data-table-edit.spec.ts (the editor-open-after-Escape race fix). */
async function enterEditAt(page: Page, row: number, col: number): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const cur = await openEditor(page);
    if (cur?.col === String(col) && cur?.row === String(row)) return;
    if (cur) {
      await page.keyboard.press('Escape');
      await expect.poll(async () => openEditor(page), { timeout: 5_000 }).toBeNull().catch(() => {});
    }
    await focusBodyCellStable(page, row, col);
    const coords = await activeCellCoords(page);
    if (coords?.row !== String(row) || coords?.col !== String(col)) continue;
    if (await openEditor(page)) continue;
    await page.keyboard.press('F2');
    try {
      await expect.poll(async () => (await openEditor(page))?.col, { timeout: 3_000 }).toBe(String(col));
      return;
    } catch {
      // opened at the wrong col / not at all — re-settle and retry.
    }
  }
  await expect.poll(async () => (await openEditor(page))?.col, { timeout: 3_000 }).toBe(String(col));
}

// Columns: name(0,text) qty(1,number,validate) status(2,select) city(3,text). No select /
// expander column (selectionMode='none', not expandable) → name is col 0.

async function gotoGrid(page: Page, target: Target) {
  await page.goto(`/?example=DataTableGridRowEdit&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  const mount = page.getByTestId('rozie-mount');
  const gridTable = mount.getByTestId('grid-table').locator('table[role="grid"]');
  await expect(gridTable).toBeVisible({ timeout: 15_000 });
  return mount;
}

for (const target of TARGETS) {
  // ════════════════════════════════════════════════════════════════════════════════
  // B21 — in full-row edit, Tab off the LAST editable cell stays CONTAINED inside the
  //   editing row (cycles to the first editor), never escaping the row + freezing grid nav.
  //   Pre-fix: row-mode Tab is NOT preventDefault'd → native Tab carries focus out of the
  //   last editor and OUT of the row, while editingRowIndex stays set → onGridKeyDown
  //   early-returns → grid frozen.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-rowedit [${target}]: B21 row Tab is contained inside the editing row; grid stays navigable`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    // Enter full-row edit on row 0 (editRow(0) — the API twin of Shift+F2).
    await mount.getByTestId('edit-row').click();
    // All four editable cells in the row open editors at once.
    await expect.poll(async () => editorCount(page), { timeout: 10_000 }).toBe(4);
    // Focus the LAST editable cell's editor (city, col 3) and Tab off the end.
    await focusRowEditorAt(page, 0, 3);
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
    await page.keyboard.press('Tab');
    // CONTAINED: focus cycles to the FIRST editor of the SAME row (row 0, col 0), staying
    // an editor input — it did NOT escape the row.
    await expect.poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 }).toBe('0');
    const a = await activeCellCoords(page);
    expect(a?.row).toBe('0');
    expect(a?.tag).toBe('input');
    // The row is STILL in edit (all four editors mounted) — Tab did not commit/clear it.
    expect(await editorCount(page)).toBe(4);
    // Grid is NOT frozen: Escape exits row edit, then ArrowDown moves the active cell.
    await page.keyboard.press('Escape');
    await expect.poll(async () => editorCount(page), { timeout: 10_000 }).toBe(0);
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('1');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B22 — a row-mode validation failure focuses the OFFENDING column's editor (qty, col 1),
  //   not the first editor (name, col 0). Pre-fix: commitRow's reject path calls
  //   focusEditorWhenReady() which resolves the FIRST [data-editing-cell] (name) regardless
  //   of which column actually failed.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-rowedit [${target}]: B22 row validation focuses the offending cell, not the first editor`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    await mount.getByTestId('edit-row').click();
    await expect.poll(async () => editorCount(page), { timeout: 10_000 }).toBe(4);
    // Set the qty editor (col 1) to the rejected sentinel 13; commit the whole row (Enter).
    await fillRowEditor(page, 0, 1, '13');
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
    const beforeRowCommits = await readoutText(page, 'row-commit-count');
    await page.keyboard.press('Enter');
    // The row stays OPEN (D-01 — invalid value never commits) and the invalid value is
    // not written: no row-edit-commit fired.
    await expect.poll(async () => editorCount(page), { timeout: 10_000 }).toBe(4);
    await expect.poll(async () => readoutText(page, 'row-commit-count'), { timeout: 10_000 }).toBe(beforeRowCommits);
    // Focus landed on the OFFENDING column's editor (qty, col 1) — not the first (name, col 0).
    await expect.poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 }).toBe('1');
    const a = await activeCellCoords(page);
    expect(a?.row).toBe('0');
    expect(a?.tag).toBe('input');
    // The model qty was NOT written to the rejected value.
    expect((await modelRows(page))[0]?.qty).not.toBe(13);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B23 — a single-cell commit under an ACTIVE sort relocates the row; DOM focus FOLLOWS
  //   the committed row to its NEW display index. Pre-fix: commitEdit's focus return is
  //   addressed by the OLD visible index (focusCellWhenReady(oldRow,col)) → after the row
  //   re-sorts away, focus lands on a DIFFERENT row (or drops to <body>).
  //
  //   Data qty: A=5,B=8,C=2,D=9. Sort qty ↑ → display C(0) A(1) B(2) D(3). Editing the
  //   visible row-1 cell (A, qty) to 99 re-sorts to C(0) B(1) D(2) A(3): A relocates from
  //   index 1 → 3, so focus must move to row 3.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-rowedit [${target}]: B23 commit under active sort follows the relocated row's focus`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    // Apply the active qty-ascending sort; confirm the display reordered (row 0 qty = 2).
    await mount.getByTestId('sort-qty').click();
    await expect.poll(async () => cellText(page, 0, 1), { timeout: 10_000 }).toBe('2');
    // Edit the visible row-1 cell (A, qty 5) → 99 (relocates A to the bottom under asc sort).
    await enterEditAt(page, 1, 1);
    await fillRowEditor(page, 1, 1, '99');
    await page.keyboard.press('Enter');
    await expect.poll(async () => editorCount(page), { timeout: 10_000 }).toBe(0);
    // Focus FOLLOWED the committed row to its new display index (3), staying a gridcell —
    // it did NOT strand on the old index 1 or drop to <body>.
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('3');
    const a = await activeCellCoords(page);
    expect(a?.col).toBe('1');
    expect(a?.role).toBe('gridcell');
    // The committed row (Alpha) carries the new value 99 and now sits at display index 3.
    await expect.poll(async () => cellText(page, 3, 1), { timeout: 10_000 }).toBe('99');
    expect((await modelRows(page)).find((r) => r.name === 'Alpha')?.qty).toBe(99);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // WR-01 — a FULL-ROW commit under an ACTIVE sort relocates the committed row; DOM focus
  //   FOLLOWS the row to its NEW display index by IDENTITY (the same B23 treatment the
  //   single-cell commitEdit got, previously missing from commitRow). Pre-fix: commitRow
  //   captures `focusRow = rowIndex` (the pre-commit visible index) and calls
  //   focusCellWhenReady(focusRow, focusCol) with the OLD fixed index → after the row
  //   re-sorts away, focus lands on whatever DIFFERENT row now occupies that index (or drops
  //   to <body>), and $data.activeRow is left stale (IN-02 — the @focusin sync then writes
  //   the WRONG activeRow). Post-fix: commitRow routes through pendingEditFollow, which
  //   refreshRowModel resolves against the FRESH model by row id.
  //
  //   Data qty: A=5,B=8,C=2,D=9. Sort qty ↑ → display C(0) A(1) B(2) D(3). editRow(0) enters
  //   FULL-ROW edit on the visible row-0 (Gamma/C, qty 2); raising its qty to 99 re-sorts to
  //   A(0) B(1) D(2) Gamma(3): Gamma relocates from index 0 → 3, so focus must move to row 3.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-rowedit [${target}]: WR-01 full-row commit under active sort follows the relocated row's focus`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    // Apply the active qty-ascending sort; confirm the display reordered (row 0 qty = 2 = Gamma).
    await mount.getByTestId('sort-qty').click();
    await expect.poll(async () => cellText(page, 0, 1), { timeout: 10_000 }).toBe('2');
    // Establish a deterministic active column (col 1 = qty) so the post-commit follow focuses col 1.
    await focusBodyCellStable(page, 0, 1);
    // Enter FULL-ROW edit on visible row 0 (Gamma, qty 2) via editRow(0); all four editors open.
    await mount.getByTestId('edit-row').click();
    await expect.poll(async () => editorCount(page), { timeout: 10_000 }).toBe(4);
    // Raise the qty editor (col 1) to 99 → under the asc sort Gamma relocates from index 0 → 3.
    await fillRowEditor(page, 0, 1, '99');
    // WR-01 race fix (the REAL root cause): editRow() calls focusEditorWhenReady(), a DEFERRED
    // (rAF-poll) auto-focus of the FIRST editor (col 0). fillRowEditor() focuses the qty editor
    // (col 1), but if the component's deferred col-0 auto-focus fires AFTER it, focus is stolen
    // back to col 0 → @focusin writes $data.activeColIndex = 0 → commitRow snapshots focusCol = 0
    // → the post-commit follow lands on col 0 (and STAYS there — it is not a transient that
    // settles). That is the ~1/6 flake. Wait for the col-1 editor focus to WIN and stay stable
    // (2 consecutive hits, mirroring focusBodyCellStable) BEFORE committing, so activeColIndex is
    // deterministically 1 at Enter. Re-assert the focus each non-hit iteration (idempotent — the
    // value is already 99) to out-race the deferred auto-focus.
    let editorFocusHits = 0;
    await expect
      .poll(
        async () => {
          const c = await activeCellCoords(page);
          if (c?.col === '1' && c?.tag === 'input') {
            editorFocusHits += 1;
          } else {
            editorFocusHits = 0;
            await fillRowEditor(page, 0, 1, '99');
          }
          return editorFocusHits;
        },
        { timeout: 5_000, intervals: [40, 40, 40, 60, 100] },
      )
      .toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Enter');
    // The whole row committed (all editors torn down).
    await expect.poll(async () => editorCount(page), { timeout: 10_000 }).toBe(0);
    // Focus FOLLOWED the committed row to its new display index (3), staying a gridcell — it
    // did NOT strand on the old index 0 (now Alpha) or drop to <body>. Poll the FULL coordinate
    // tuple (row:col:role) so the snapshot only fires on a fully settled frame.
    await expect
      .poll(
        async () => {
          const c = await activeCellCoords(page);
          return c ? `${c.row}:${c.col}:${c.role}` : null;
        },
        { timeout: 10_000 },
      )
      .toBe('3:1:gridcell');
    const a = await activeCellCoords(page);
    expect(a?.col).toBe('1');
    expect(a?.role).toBe('gridcell');
    // The committed row (Gamma) carries qty 99 and now sits at display index 3.
    await expect.poll(async () => cellText(page, 3, 1), { timeout: 10_000 }).toBe('99');
    expect((await modelRows(page)).find((r) => r.name === 'Gamma')?.qty).toBe(99);
  });
}
