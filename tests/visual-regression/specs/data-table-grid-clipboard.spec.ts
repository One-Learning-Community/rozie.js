import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-3 — the clipboard + fill correctness behavioral battery (B7, B8, B9, B10,
 * B11), RED-first. Drives `examples/demos/DataTableGridClipboardDemo.rozie`
 * (?example=DataTableGridClipboard) across all six targets. Each assertion FAILS on the
 * pre-fix build for the affected targets and PASSES after the shared-source fix is
 * re-emitted (SC-1).
 *
 *   B7  — fill-drag copies each SOURCE column's OWN value down its OWN column (not a single
 *         scalar broadcast); an UP drag reads the pre-drag origin row, not the post-drag
 *         box corner. (DATA LOSS pre-fix.)
 *   B8  — a filter-to-fewer-rows clamps the range corners to the new bounds, so a copy
 *         contains only in-bounds rows (no phantom/stale trailing row).
 *   B9  — paste coerces each TSV cell to its column type: a numeric column commits a Number,
 *         an empty pasted cell commits null (never a raw string).
 *   B10 — a cell containing a tab + newline + double-quote round-trips through copy→paste
 *         exactly (TSV field escaping).
 *   B11 — Ctrl+C / Ctrl+V are NO-OPS while a HEADER cell is active (no silent body mutation).
 *
 * Helpers (activeCellCoords / focusBodyCell* / readoutText / modelRows / shadow-pierced
 * finds) follow data-table-grid-edit.spec.ts / data-table-grid-rowedit.spec.ts.
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
 * UNIFORM across all six (incl. Lit shadow) via `getRootNode().activeElement`.
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
        if (sr) { const inner = findGridTable(sr); if (inner) return inner; }
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

/** Read a readout testid's trimmed text (shadow-pierced), '' when absent. */
async function readoutText(page: Page, testid: string): Promise<string> {
  return page.evaluate((id) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(`[data-testid="${id}"]`);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const inner = find(sr); if (inner) return inner; }
      }
      return null;
    };
    const el = find(document);
    return el ? (el.textContent || '').trim() : '';
  }, testid);
}

interface ModelRow { id: number; label: string; qty: unknown; cost: unknown; city: string }

/** The committed model (JSON.parsed from the model-readout dump). Preserves number-vs-string
 *  types through the JSON round-trip (the B9 typeof assertions rely on this). */
async function modelRows(page: Page): Promise<ModelRow[]> {
  const raw = await readoutText(page, 'model-readout');
  try {
    return JSON.parse(raw) as ModelRow[];
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

/** Focus (row, col) and KEEP it until the active cell settles there AND holds. */
async function focusBodyCellStable(page: Page, row: number, col: number): Promise<void> {
  await focusBodyCell(page, row, col);
  let stableHits = 0;
  await expect
    .poll(
      async () => {
        const a = await activeCellCoords(page);
        if (a?.row === String(row) && a?.col === String(col)) stableHits += 1;
        else { stableHits = 0; await focusBodyCell(page, row, col); }
        return stableHits;
      },
      { timeout: 5_000, intervals: [40, 40, 40, 60, 100] },
    )
    .toBeGreaterThanOrEqual(2);
}

/**
 * Build a range from the active cell by pressing Shift+<dir> `steps` times, then wait for
 * @range-change to flush the moving focus corner to (toRow,toCol). The range-readout gate is
 * load-bearing on React (setState is async — without it a same-tick re-read sees the stale
 * pre-move corner).
 */
async function extendRangeBy(page: Page, dir: 'Right' | 'Left' | 'Down' | 'Up', steps: number, toRow: number, toCol: number): Promise<void> {
  for (let i = 0; i < steps; i++) await page.keyboard.press(`Shift+Arrow${dir}`);
  await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe(`${toRow},${toCol}`);
}

/**
 * Drive a fill-handle drag to the cell (toRow,toCol). Dispatches a real pointerdown on the
 * [data-fill-handle] (capturing the pre-drag source rectangle), a document pointermove to the
 * target cell's center (extends the range via setRangeFocus → cellIndexFromPoint), WAITS for
 * @range-change to flush (so fillRange reads the FRESH rectangle on React), then a document
 * pointerup (→ fillRange). Coordinates come from getBoundingClientRect so it is deterministic
 * (no Playwright pixel hit-testing of the 8px handle); cellIndexFromPoint pierces the Lit
 * shadow root.
 */
async function fillDragTo(page: Page, toRow: number, toCol: number): Promise<void> {
  // Settle so the SOURCE range (built before this call) is INTERNALLY committed on React
  // before pointerdown snapshots it (the range-readout gate observes the emitted event, which
  // fires a tick before React's internal $data.rangeFocus useState commits — a synthetic
  // same-tick concern only; real drags span real frames).
  await page.waitForTimeout(150);
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
    const handle = grid.querySelector('[data-fill-handle]') as HTMLElement | null;
    const target = grid.querySelector(`[data-grid-cell][data-row="${tr}"][data-col-index="${tc}"]`) as HTMLElement | null;
    if (!handle || !target) return;
    const hr = handle.getBoundingClientRect();
    const trc = target.getBoundingClientRect();
    const hx = hr.left + hr.width / 2;
    const hy = hr.top + hr.height / 2;
    const cx = trc.left + trc.width / 2;
    const cy = trc.top + trc.height / 2;
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: hx, clientY: hy }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: cx, clientY: cy }));
  }, { tr: toRow, tc: toCol });
  // Wait for setRangeFocus to flush the moving corner (the emitted event), then settle so the
  // data-table's INTERNAL $data.rangeFocus useState commits on React before pointerup →
  // fillRange reads normalizedRange() (else it reads the pre-move stale rectangle, ROZ138).
  await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe(`${toRow},${toCol}`);
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
    const target = grid.querySelector(`[data-grid-cell][data-row="${tr}"][data-col-index="${tc}"]`) as HTMLElement | null;
    if (!target) return;
    const r = target.getBoundingClientRect();
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }, { tr: toRow, tc: toCol });
}

async function gotoGrid(page: Page, target: Target) {
  await page.goto(`/?example=DataTableGridClipboard&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  const mount = page.getByTestId('rozie-mount');
  const gridTable = mount.getByTestId('grid-table').locator('table[role="grid"]');
  await expect(gridTable).toBeVisible({ timeout: 15_000 });
  return mount;
}

// The tricky B10 payload: a tab, a newline, AND a double-quote in one cell (row 0, label).
const TRICKY = 'a"x\ty\nz';

for (const target of TARGETS) {
  // ════════════════════════════════════════════════════════════════════════════════
  // B7 (down) — fill-drag copies each SOURCE column's OWN value down its OWN column.
  //   Source = row 1 cols 0..2 (['Beta', 11, 21]); drag the handle DOWN to row 3.
  //   Pre-fix: fillRange broadcasts cellValueAt(box.r0,box.c0) ('Beta') into EVERY cell →
  //   qty/cost columns get the string 'Beta' (multi-column data loss).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: B7 fill-drag DOWN copies each source column down its own column`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 1, 0);
    await extendRangeBy(page, 'Right', 2, 1, 2); // range row1 cols 0..2
    await fillDragTo(page, 3, 2); // drag down to row 3

    // Rows 2 + 3 each equal the source row PER COLUMN (label='Beta', qty=11, cost=21) —
    // NOT all 'Beta', NOT clobbered.
    await expect
      .poll(async () => { const m = await modelRows(page); return JSON.stringify([m[2]?.label, m[2]?.qty, m[2]?.cost]); }, { timeout: 10_000 })
      .toBe(JSON.stringify(['Beta', 11, 21]));
    const m = await modelRows(page);
    expect([m[3]?.label, m[3]?.qty, m[3]?.cost]).toEqual(['Beta', 11, 21]);
    // The numeric columns committed as Numbers (per-column source preserved its type).
    expect(typeof m[2]?.qty).toBe('number');
    expect(typeof m[2]?.cost).toBe('number');
    // The source row is intact.
    expect([m[1]?.label, m[1]?.qty, m[1]?.cost]).toEqual(['Beta', 11, 21]);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B7 (up) — an UP drag reads the PRE-DRAG origin row, not the post-drag box corner.
  //   Source = row 4 cols 0..2 (['Echo', 14, 24]); drag the handle UP to row 2 → rows 2 + 3
  //   must copy ROW 4's values. Pre-fix: fillRange reads cellValueAt(box.r0=2, box.c0=0) =
  //   'Gamma' (a TARGET cell at the flipped top corner) and broadcasts it.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: B7 fill-drag UP reads the pre-drag origin row, not the flipped corner`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 4, 0);
    await extendRangeBy(page, 'Right', 2, 4, 2); // range row4 cols 0..2
    await fillDragTo(page, 2, 2); // drag UP to row 2

    await expect
      .poll(async () => { const m = await modelRows(page); return JSON.stringify([m[2]?.label, m[2]?.qty, m[2]?.cost]); }, { timeout: 10_000 })
      .toBe(JSON.stringify(['Echo', 14, 24]));
    const m = await modelRows(page);
    expect([m[3]?.label, m[3]?.qty, m[3]?.cost]).toEqual(['Echo', 14, 24]);
    // It did NOT read the flipped top corner (row 2's pre-fill 'Gamma').
    expect(m[2]?.label).not.toBe('Gamma');
    expect(typeof m[2]?.qty).toBe('number');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B8 — a filter-to-fewer-rows CLAMPS the range corners to the new bounds, so a copy can
  //   never include phantom/stale rows past the shrunken model. Range = qty col rows 0..2;
  //   filter 'Oslo' keeps rows 0 + 4 (qty 10 + 14) → a 2-row model (maxRow 1). Post-fix:
  //   clampRange clamps focus row 2 → row 1 (corners '0,1-1,1'). Pre-fix: the corners are
  //   left untouched at '0,1-2,1' (a phantom row 2 off the shrunken model). The range is
  //   asserted via the getSelectedRange() verb (a grid re-focus would collapse the range,
  //   so the data change is driven from the filter input and the corners read off the
  //   persisted $data range, never re-entering the grid).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: B8 range corners clamp on filter-to-fewer (no phantom rows)`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 1);
    await extendRangeBy(page, 'Down', 2, 2, 1); // range col1 rows 0..2 (focus row 2)

    // Shrink the model to 2 rows (the range persists in $data — the filter input does not
    // re-enter the grid, so @focusin never collapses it; refreshRowModel runs clampRange).
    await mount.getByTestId('global-filter').fill('Oslo');
    await expect
      .poll(async () => mount.getByTestId('grid-table').locator('tbody [role="row"]').count(), { timeout: 10_000 })
      .toBe(2);

    // The range corners clamped into the 2-row model (focus row 2 → 1) — no phantom row.
    await mount.getByTestId('get-range').click();
    await expect.poll(async () => readoutText(page, 'selrange-readout'), { timeout: 10_000 }).toBe('0,1-1,1');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B9 — paste coerces each TSV cell to its column type. '42\t7' into (0,1) → qty Number 42,
  //   cost Number 7; '8\t' into (1,1) → qty 8, cost null (empty). Pre-fix: raw strings.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: B9 paste coerces TSV to the column type (number / empty→null)`, async ({ page }) => {
    await gotoGrid(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.evaluate(() => navigator.clipboard.writeText('42\t7'));
    await focusBodyCellStable(page, 0, 1);
    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await modelRows(page))[0]?.qty, { timeout: 10_000 }).toBe(42);
    const m1 = await modelRows(page);
    expect(typeof m1[0]?.qty).toBe('number');
    expect(m1[0]?.cost).toBe(7);
    expect(typeof m1[0]?.cost).toBe('number');

    await page.evaluate(() => navigator.clipboard.writeText('8\t'));
    await focusBodyCellStable(page, 1, 1);
    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await modelRows(page))[1]?.qty, { timeout: 10_000 }).toBe(8);
    const m2 = await modelRows(page);
    expect(typeof m2[1]?.qty).toBe('number');
    expect(m2[1]?.cost).toBeNull();
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B10 — a tab+newline+quote cell round-trips through copy→paste exactly. Copy (0,0)
  //   (label TRICKY), paste into (1,0) → model[1].label === TRICKY. Pre-fix: no escaping →
  //   the raw tab/newline split corrupts the cell on parse.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: B10 TSV round-trips a tab+newline+quote cell`, async ({ page }) => {
    await gotoGrid(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Sanity: row 0 label holds the tricky value.
    await expect.poll(async () => (await modelRows(page))[0]?.label, { timeout: 10_000 }).toBe(TRICKY);

    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('Control+c');
    // The clipboard holds an ESCAPED (quoted, doubled-quote) field — not the raw value.
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText()), { timeout: 10_000 }).toBe('"a""x\ty\nz"');

    await focusBodyCellStable(page, 1, 0);
    await page.keyboard.press('Control+v');
    // Round-tripped EXACTLY into (1,0).
    await expect.poll(async () => (await modelRows(page))[1]?.label, { timeout: 10_000 }).toBe(TRICKY);
    // Source unchanged.
    expect((await modelRows(page))[0]?.label).toBe(TRICKY);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B11 — Ctrl+C / Ctrl+V are NO-OPS while a HEADER cell is active. Pre-fix: pasteRange
  //   anchors at the stale body activeRow and silently writes the body.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: B11 Ctrl+C/Ctrl+V are no-ops on a header cell (no body mutation)`, async ({ page }) => {
    await gotoGrid(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Sit on a body cell, then ArrowUp into the header row (active becomes the columnheader).
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('__header');

    const before = await readoutText(page, 'model-readout');
    await page.evaluate(() => navigator.clipboard.writeText('999\t999'));
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    // Give the async clipboard read a chance to (wrongly) apply, then assert NOTHING changed.
    await page.waitForTimeout(400);
    expect(await readoutText(page, 'model-readout')).toBe(before);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // C3 (single→range fill) — pasting a SINGLE copied cell into a selected RANGE fills the
  //   WHOLE range (spreadsheet semantics). Copy qty (0,1) = 10, select a 3×2 range over the
  //   two numeric columns (qty+cost, rows 0..2), paste → all six cells == 10 (Number).
  //   Pre-fix: pasteRange lands a 1×1 block at the range top-left, leaving the other 5 cells
  //   untouched (RED). Numeric columns keep the assertion type-clean.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: C3 single cell pasted into a range fills the whole range`, async ({ page }) => {
    await gotoGrid(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Copy the single qty cell (0,1) = 10.
    await focusBodyCellStable(page, 0, 1);
    await page.keyboard.press('Control+c');
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText()), { timeout: 10_000 }).toBe('10');

    // Select a 3×2 range over the two numeric columns: rows 0..2 (Shift+Down ×2), cols 1..2 (Shift+Right ×1).
    await extendRangeBy(page, 'Down', 2, 2, 1);
    await extendRangeBy(page, 'Right', 1, 2, 2);
    await page.waitForTimeout(200); // settle React's internal range commit before the synchronous paste read

    await page.keyboard.press('Control+v');

    // All six cells in the 3×2 range == 10 (Number) — the single cell FILLED the range, not a 1×1 block.
    await expect
      .poll(async () => { const m = await modelRows(page); return JSON.stringify([m[0]?.qty, m[1]?.qty, m[2]?.qty, m[0]?.cost, m[1]?.cost, m[2]?.cost]); }, { timeout: 10_000 })
      .toBe(JSON.stringify([10, 10, 10, 10, 10, 10]));
    const m = await modelRows(page);
    expect(typeof m[2]?.cost).toBe('number');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // C3 (tiling) — a SMALLER clipboard block TILES into a LARGER selection. Copy a 2×2 block
  //   (qty+cost, rows 0..1) = [[10,20],[11,21]], extend to a 4×2 range (rows 0..3), paste → the
  //   2×2 block REPEATS down the four rows: row r mirrors source[r % 2] (row 2 repeats row 0,
  //   row 3 repeats row 1). Pre-fix: a single 2×2 block lands at the top, rows 2..3 untouched
  //   (RED). Numeric columns keep the tiling assertion type-clean.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: C3 a 2x2 clipboard tiling into a 4x2 selection repeats`, async ({ page }) => {
    await gotoGrid(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Build + copy the 2×2 source (qty+cost rows 0..1). From (0,1): Shift+Right (→0,2), Shift+Down (→1,2).
    await focusBodyCellStable(page, 0, 1);
    await extendRangeBy(page, 'Right', 1, 0, 2);
    await extendRangeBy(page, 'Down', 1, 1, 2);
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+c');
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText()), { timeout: 10_000 }).toBe('10\t20\n11\t21');

    // Extend the SAME range down to a 4×2 destination (rows 0..3): Shift+Down ×2 → focus (3,2).
    await extendRangeBy(page, 'Down', 2, 3, 2);
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+v');

    // The 2×2 block tiled down the four rows: row 2 repeats row 0, row 3 repeats row 1.
    await expect
      .poll(async () => { const m = await modelRows(page); return JSON.stringify([m[2]?.qty, m[2]?.cost, m[3]?.qty, m[3]?.cost]); }, { timeout: 10_000 })
      .toBe(JSON.stringify([10, 20, 11, 21]));
    const m = await modelRows(page);
    // Source rows unchanged; every tiled numeric cell committed as a Number.
    expect([m[0]?.qty, m[0]?.cost, m[1]?.qty, m[1]?.cost]).toEqual([10, 20, 11, 21]);
    expect(typeof m[2]?.qty).toBe('number');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // C3 (Cut) — Ctrl+X copies the source range THEN clears the source cells through the SAME
  //   write-funnel as paste (one writeData). Select a 2×1 range (qty rows 0..1 = [10,11]),
  //   Ctrl+X → qty rows 0+1 cleared to null (a numeric column's empty); the clipboard holds
  //   "10\n11"; a paste at qty rows 3..4 RESTORES them. Pre-fix: Cut does not exist — Ctrl+X
  //   is unhandled, so the source is never cleared and the clipboard is never written (RED).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: C3 Cut clears the source through the write-funnel and the clipboard restores on paste`, async ({ page }) => {
    await gotoGrid(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Select a 2×1 range over qty rows 0..1.
    await focusBodyCellStable(page, 0, 1);
    await extendRangeBy(page, 'Down', 1, 1, 1);
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+x');

    // Source cells cleared to null (a numeric column's empty), committed in a single writeData.
    await expect.poll(async () => (await modelRows(page))[0]?.qty, { timeout: 10_000 }).toBeNull();
    expect((await modelRows(page))[1]?.qty).toBeNull();
    // The clipboard holds the cut values (a subsequent paste can restore them).
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText()), { timeout: 10_000 }).toBe('10\n11');

    // Paste the cut values elsewhere (qty rows 3..4) — restored.
    await focusBodyCellStable(page, 3, 1);
    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await modelRows(page))[3]?.qty, { timeout: 10_000 }).toBe(10);
    expect((await modelRows(page))[4]?.qty).toBe(11);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // C3 (Cut header no-op) — Ctrl+X is a NO-OP while a HEADER cell is active (extends the B11
  //   clipboardActiveAllowed() guard to Cut, so Cut can never silently clear a body cell from a
  //   header anchor). Guard non-regression: GREEN both pre- and post-fix (pre-fix Ctrl+X is
  //   unhandled; post-fix the guard blocks it) — it cements the guard the way B11 cements copy/paste.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-clipboard [${target}]: C3 Cut is a no-op on a header cell (no body mutation)`, async ({ page }) => {
    await gotoGrid(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await focusBodyCellStable(page, 0, 1);
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('__header');

    const before = await readoutText(page, 'model-readout');
    await page.keyboard.press('Control+x');
    await page.waitForTimeout(400);
    expect(await readoutText(page, 'model-readout')).toBe(before);
  });
}
