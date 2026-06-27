import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-5 — the grid emit-hygiene / gating / re-focus behavioral battery (B14, B15,
 * B16, B17, B18, B19, B20, B25), RED-first. Drives
 * `examples/demos/DataTableGridEmitDemo.rozie` (?example=DataTableGridEmit) across all six
 * targets. Each assertion FAILS on the pre-fix build for the affected targets and PASSES after
 * the shared-source fix is re-emitted (SC-1).
 *
 *   B14 — focusCell() emits activecell-change ONLY on a real index change; a clamped/no-op
 *         focusCell to the already-active cell does NOT emit (the WR-06 net-count proof).
 *   B15 — getActiveCell() reports the header-active state (rowIndex null / isHeader true →
 *         readout 'header,c'), NOT a false body 'row 0'.
 *   B16 — the exposed focusCell/clearActiveCell verbs are isGrid()-gated no-ops in TABLE mode
 *         (the sibling table instance's activecell-change count stays 0).
 *   B17 — PageDown from a header lands a DEEP page-down body cell (row 7 here), NOT body row 0
 *         (== ArrowDown).
 *   B18 — extendRange emits range-change ONLY on a real change; a clamped no-op Shift+Arrow
 *         does NOT emit.
 *   B19 — clearRange emits range-change (a consumer mirroring the range via the event sees the
 *         drop), currently it never does.
 *   B20 — a fill-drag pointermove over the SAME cell repeatedly emits range-change ONCE (per
 *         distinct cell), not once per pointermove.
 *   B25 — a programmatic shrink (pageSize / data swap) re-indexes AND re-focuses the active
 *         cell — DOM focus is recovered onto a valid grid cell, not dropped to <body>.
 *
 * Net-count proofs (B14/B18/B20) mirror data-table-grid.spec.ts WR-06: from a settled base,
 * a known number of REAL emits bracket the no-op, and the settled counter must rise by exactly
 * that number (a spurious/missing emit shifts it). Helpers follow data-table-grid-clipboard.spec.ts.
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
 * across all six (incl. Lit shadow) via `getRootNode().activeElement`. Resolves the GRID-mode
 * table (role="grid" — the sibling table-mode instance is role="table"). Returns null when
 * nothing inside the grid is focused (focus dropped to <body>).
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

async function readoutNumber(page: Page, testid: string): Promise<number> {
  return Number(await readoutText(page, testid));
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
 * Drive a fill-handle drag that visits the SAME target cell (toRow,toCol) `repeats` times.
 * Dispatches a real pointerdown on the [data-fill-handle], then `repeats` pointermoves all to
 * the SAME cell center (B20: only the FIRST distinct cell should emit range-change — the rest
 * are deduped), then a document pointerup. cellIndexFromPoint pierces the Lit shadow root.
 */
async function fillDragSameCell(page: Page, toRow: number, toCol: number, repeats: number): Promise<void> {
  await page.evaluate(({ tr, tc, n }) => {
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
    for (let i = 0; i < n; i++) {
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: cx, clientY: cy }));
    }
  }, { tr: toRow, tc: toCol, n: repeats });
  await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe(`${toRow},${toCol}`);
  await page.evaluate(() => {
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
}

for (const target of TARGETS) {
  // ── B14 / B15 / B16 — emit hygiene + getActiveCell header sentinel + isGrid table-mode gate ──
  runnerFor(target)(`data-table-grid-emit [${target}]: focusCell no-op suppression (B14); getActiveCell header (B15); isGrid table-mode gate (B16)`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridEmit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    const gridTable = mount.getByTestId('grid-table').locator('table');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    // ── B14: focusCell(1,1) is a real move (emits); a SECOND focusCell(1,1) to the SAME cell
    //    is a clamped no-op (NO emit); focusCell(2,2) is a real move again. Net-count proof:
    //    from the settled base after the first move, exactly ONE more emit lands by the (2,2)
    //    settle — the no-op contributes zero (pre-fix it spuriously emits → +2). ───────────────
    await mount.getByTestId('call-focuscell-11').click();
    await expect.poll(async () => readoutText(page, 'activecell-readout'), { timeout: 10_000 }).toBe('1,1');
    const base = await readoutNumber(page, 'activecell-count');
    await mount.getByTestId('call-focuscell-11').click(); // SAME cell — B14: no emit
    await mount.getByTestId('call-focuscell-22').click(); // real move → emits '2,2'
    await expect.poll(async () => readoutText(page, 'activecell-readout'), { timeout: 10_000 }).toBe('2,2');
    await expect
      .poll(async () => readoutNumber(page, 'activecell-count'), { timeout: 10_000 })
      .toBe(base + 1);

    // ── B15: with a HEADER cell active (ArrowUp from body row 0), getActiveCell() reports the
    //    header sentinel ('header,0'), NOT a false body 'row 0' ('0,0' pre-fix). ───────────────
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('__header');
    await mount.getByTestId('call-getactivecell').click();
    await expect
      .poll(async () => readoutText(page, 'getactivecell-readout'), { timeout: 10_000 })
      .toBe('header,0');

    // ── B16: the TABLE-mode sibling's focusCell/clearActiveCell are isGrid()-gated no-ops —
    //    its activecell-change never fires (the count stays 0). Pre-fix focusCell emits in
    //    table mode → the count rises. ──────────────────────────────────────────────────────
    await mount.getByTestId('call-table-focuscell').click();
    await mount.getByTestId('call-table-clearactive').click();
    // Allow any (erroneous) async emit to settle before asserting the count held at 0.
    await page.waitForTimeout(500);
    expect(await readoutNumber(page, 'table-activecell-count')).toBe(0);
  });

  // ── B17 — PageDown from a header lands a DEEP body cell, distinct from ArrowDown's row 0 ──
  runnerFor(target)(`data-table-grid-emit [${target}]: PageDown from header lands a page-down body cell, not row 0 (B17)`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridEmit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('grid-table').locator('table')).toBeVisible({ timeout: 15_000 });

    // PageDown from the leaf header → a REAL page-down body row (GRID_PAGE_STEP=10 over 8 rows
    // → clamp to the last row, 7). Pre-fix it collapses to body row 0 (== ArrowDown).
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('__header');
    await page.keyboard.press('PageDown');
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('7');

    // Contrast: ArrowDown from the header lands body row 0 (the baseline PageDown must DIFFER
    // from — this is the cell PageDown wrongly collapsed to pre-fix).
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('__header');
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('0');
  });

  // ── B18 / B19 — extendRange no-op suppression + clearRange emits ──────────────────────────
  runnerFor(target)(`data-table-grid-emit [${target}]: extendRange no-op does not emit (B18); clearRange emits range-change (B19)`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridEmit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('grid-table').locator('table')).toBeVisible({ timeout: 15_000 });

    await focusBodyCellStable(page, 1, 0);
    // Extend the range to the RIGHT EDGE (col 2 of 3): two real extends emit.
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe('1,1');
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe('1,2');

    // B18: a clamped no-op Shift+Right at the right edge does NOT emit; the following real
    // Shift+Down does. Net-count: exactly ONE emit since the base (the no-op adds zero).
    const cBase = await readoutNumber(page, 'range-count');
    await page.keyboard.press('Shift+ArrowRight'); // clamped at col 2 — B18: NO emit
    await page.keyboard.press('Shift+ArrowDown');  // real extend → (2,2)
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe('2,2');
    await expect
      .poll(async () => readoutNumber(page, 'range-count'), { timeout: 10_000 })
      .toBe(cBase + 1);

    // B19: a plain (non-shift) Arrow collapses the range → clearRange must EMIT range-change
    // (focus null → the readout clears to ''), so a consumer mirroring the range via the event
    // sees the drop. Pre-fix clearRange is silent (readout stays '2,2', count unchanged).
    const dBase = await readoutNumber(page, 'range-count');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe('');
    await expect
      .poll(async () => readoutNumber(page, 'range-count'), { timeout: 10_000 })
      .toBe(dBase + 1);
  });

  // ── B20 — fill-drag dedups same-cell pointermove (one range-change per distinct cell) ──────
  runnerFor(target)(`data-table-grid-emit [${target}]: fill-drag same-cell pointermove dedup — one range-change per distinct cell (B20)`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridEmit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('grid-table').locator('table')).toBeVisible({ timeout: 15_000 });

    // Build a range so a fill handle renders at its bottom-right corner (2,0).
    await focusBodyCellStable(page, 1, 0);
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe('2,0');

    // Drag the fill handle to (4,0) and dispatch FOUR pointermoves all to that SAME cell.
    // B20: range-change fires ONCE (the single distinct target cell), not four times.
    const eBase = await readoutNumber(page, 'range-count');
    await fillDragSameCell(page, 4, 0, 4);
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe('4,0');
    await expect
      .poll(async () => readoutNumber(page, 'range-count'), { timeout: 10_000 })
      .toBe(eBase + 1);
  });

  // ── B25 — programmatic shrink re-focuses the active cell (focus not dropped to <body>) ─────
  runnerFor(target)(`data-table-grid-emit [${target}]: programmatic shrink re-focuses a valid cell, not <body> (B25)`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridEmit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('grid-table').locator('table')).toBeVisible({ timeout: 15_000 });

    // (a) PageSize shrink: focus a DEEP cell (6,0) then setRowsPerPage(3) — the focused cell's
    //     row vanishes. clampActiveCell re-indexes to (2,0) AND recovers DOM focus there
    //     (pre-fix focus drops to <body> → activeCellCoords resolves no cell).
    await mount.getByTestId('shrink-pagesize').click();
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('2');
    await expect.poll(async () => (await activeCellCoords(page))?.role, { timeout: 10_000 }).toBe('gridcell');

    // (b) Data swap: focus a deep cell then replace the bound dataset with a 3-row subset.
    //     The same clampActiveCell focus-recovery applies.
    await page.goto(`/?example=DataTableGridEmit&target=${target}`);
    await expect(mount.getByTestId('grid-table').locator('table')).toBeVisible({ timeout: 15_000 });
    await mount.getByTestId('shrink-dataswap').click();
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('2');
    await expect.poll(async () => (await activeCellCoords(page))?.role, { timeout: 10_000 }).toBe('gridcell');
  });
}
