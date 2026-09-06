import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * data-table-grouped-defs.spec.ts — quick task 260906-afh. RED-first behavioral proof for
 * two shared-engine data-table defects. Every test title carries the literal token
 * `grouped-defs` so `--grep grouped-defs` scopes the whole file. Assertion-only — no
 * `toHaveScreenshot`, no PNG baseline.
 *
 * B1 — nested group leaf columns (a `columns:` group child) are never registered in the
 *      def-lookup map, so `defFor(colId)` returns null for them and `headerLabel` falls
 *      back to the raw column id. Fixture: DataTableGridGroupedHeaderDemo (two 2-level
 *      header groups: Identity → {Name, City}, Metrics → {Qty, Cost}).
 *      RED at HEAD: the `name`/`city` leaf headers render their raw lowercase column id.
 *      GREEN: they render the declared `header` text ('Name'/'City'). The parent group
 *      header ('Identity') is unaffected either way — it is already a top-level table-core
 *      column and resolves through the existing (unfixed) code path.
 *
 * B2 — on a group-header row the `#cell` scoped slot receives the FIRST LEAF's record as
 *      `row` (table-core builds group rows via `createRow(table, id, leafRows[0].original, …)`),
 *      so a consumer template reading `row.someField` paints leaf #1's value on the group
 *      line. Fixture: DataTableGroupPlaceholderDemo (multi-level grouping by
 *      ['region', 'city']; `product`/`qty` are non-grouping columns → aggregated on a group
 *      row → they take the #cell r-else branch and are exactly the cells that leak `row`).
 *      RED at HEAD: the `product` cell on the North region group-header row reports
 *      `LEAF:Apple` (leaf #1's record). GREEN: it reports `GROUP:region:North:3` (the
 *      locked descriptor shape; `leafCount` reuses the `groupSubRowCount(row)` helper
 *      verbatim per the plan's key_links contract — CORRECTED by quick 260906-cvo C4 to
 *      count only TRUE leaf records under multi-level grouping, excluding North's 2
 *      intermediate city sub-group nodes (Oslo, Bergen); see `grouped-defs C4` below for the
 *      RED-first proof of that fix. Pre-260906-cvo this read 5 — the 2 city sub-groups PLUS
 *      the 3 true records — a since-closed `groupSubRowCount` over-count, not a B2 defect).
 *      A leaf row's `product` cell still reports `LEAF:<product>`.
 *
 * C3 (quick 260906-cvo, Task 1) — the #selectCell and #editor scoped slots STILL bound
 *      `:row="row.original"` / `:row="wr.row.original"` (the B2 fix only rewired the #cell
 *      slot's 4 sites), so on a group-header row they too leaked the first leaf's record.
 *      Fixture: DataTableGroupEditGuardDemo (single-level grouping by `region`).
 *      RED at HEAD: `[data-selectprobe]` on the North group-header row reports `LEAF:Apple`.
 *      The #editor probe is reachable ONLY because of the STILL-LIVE C1 defect (a
 *      group-header row is editable at HEAD) — Enter on its `qty` cell opens the editor,
 *      and `[data-editorprobe]` also reports `LEAF:Apple`. GREEN: both report the measured
 *      group descriptor. A leaf row's `[data-selectprobe]` is the unchanged control
 *      (`LEAF:<product>`) throughout.
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

// ═══════════════════════════════════════════════════════════════════════════════════
// B1 — nested group leaf columns resolve their own def (header text, not the raw id).
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`grouped-defs B1 [${target}]: nested leaf columns render their declared header text`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridGroupedHeader&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('grid-table');
    await expect(gridContainer.locator('table')).toBeVisible({ timeout: 15_000 });

    // Sortable nested leaf ('name', under the 'identity' group): RED at HEAD renders the
    // raw column id 'name'; GREEN renders the declared header text 'Name'.
    await expect(gridContainer.locator('[data-col="name"] .rdt-header-label')).toHaveText('Name', {
      timeout: 15_000,
    });

    // Non-sortable nested leaf ('city'): RED at HEAD renders 'city'; GREEN renders 'City'.
    await expect(gridContainer.locator('[data-col="city"] .rdt-header-label')).toHaveText('City', {
      timeout: 15_000,
    });

    // The PARENT group header is unaffected — it was already a top-level table-core column
    // and resolves through the existing (unfixed) code path. Control assertion: passes both
    // pre- and post-fix.
    await expect(gridContainer.locator('[data-col="identity"] .rdt-header-label')).toHaveText('Identity', {
      timeout: 15_000,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// B2 — a group-header row's #cell slot receives a stable GROUP DESCRIPTOR as `row`, never
// the first leaf's record.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`grouped-defs B2 [${target}]: group-header row #cell slot receives a group descriptor, not the first leaf's record`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGroupPlaceholder&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const container = mount.getByTestId('placeholder-table');
    await expect(container.locator('table')).toBeVisible({ timeout: 15_000 });

    // Multi-level grouping engages one frame after mount (post-mount write).
    await expect
      .poll(async () => mount.getByTestId('grouping-readout').textContent(), { timeout: 15_000 })
      .toBe('region,city');
    await expect
      .poll(async () => container.locator('tbody tr[data-group-header]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // The top-level 'North' region group-header row — located by its own grouped-cell
    // value (never by row order, which the fixture happens to match but should not be
    // relied on).
    const northRow = container.locator('tbody tr[data-group-header]').filter({
      has: page.locator('.rdt-group-value', { hasText: 'North' }),
    });
    await expect(northRow).toHaveCount(1, { timeout: 15_000 });

    // 'product' is a NON-grouping column → AGGREGATED on this group row → it flows through
    // the SAME #cell slot as an ordinary leaf row (the aggregated-cell `row` leak this task
    // fixes). RED at HEAD: table-core hands the slot the FIRST LEAF's record (id 1, product
    // 'Apple') as `row`, so rowProbe(row) resolves 'LEAF:Apple'. GREEN: the group
    // descriptor, so rowProbe(row) resolves 'GROUP:region:North:3' (leafCount reuses
    // groupSubRowCount(row) verbatim — the 3 true leaf records under North, post-C4-fix;
    // see the file-header doc comment and `grouped-defs C4` below).
    const productProbe = northRow.locator('[data-col="product"] [data-testid="cell-display"]');
    await expect(productProbe).toHaveAttribute('data-rowprobe', 'GROUP:region:North:3', {
      timeout: 15_000,
    });

    // An ordinary LEAF row's product cell is unaffected — it still reports its own record.
    const leafRow = container.locator('tbody tr[data-group-leaf]').first();
    const leafProbe = leafRow.locator('[data-col="product"] [data-testid="cell-display"]');
    await expect(leafProbe).toHaveAttribute('data-rowprobe', /^LEAF:/, { timeout: 15_000 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// C3 (quick 260906-cvo, Task 1) — #selectCell and #editor route :row through cellSlotRow.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`grouped-defs C3 [${target}]: #selectCell and #editor receive a group descriptor, not the first leaf's record`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGroupEditGuard&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const container = mount.getByTestId('grid-table');
    await expect(container.locator('table')).toBeVisible({ timeout: 15_000 });

    // Single-level grouping by 'region' engages one frame after mount.
    await expect
      .poll(async () => mount.getByTestId('grouping-readout').textContent(), { timeout: 15_000 })
      .toBe('region');
    await expect
      .poll(async () => container.locator('tbody tr[data-group-header]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    const northRow = container.locator('tbody tr[data-group-header]').filter({
      has: page.locator('.rdt-group-value', { hasText: 'North' }),
    });
    await expect(northRow).toHaveCount(1, { timeout: 15_000 });

    // (a) #selectCell: RED at HEAD reports 'LEAF:Apple' (table-core's leaked first-leaf
    // record); GREEN reports the measured group descriptor (single-level grouping — North's
    // 3 leaf records, no multi-level over-count).
    const selectProbe = northRow.locator('[data-selectprobe]');
    await expect(selectProbe).toHaveAttribute('data-selectprobe', 'GROUP:region:North:3', {
      timeout: 15_000,
    });

    // (b) #editor — Task 1 -> Task 2 HANDOFF (per <verification>): this assertion was
    // originally "Enter on the group row's 'qty' cell opens the #editor drop-in, reporting
    // the group descriptor" — reachable ONLY because C1 was still open when Task 1 ran.
    // Task 2 (C1) closes that: a group-header row is no longer editable at all, so no
    // editor renders on it — REPLACED here with that fact, plus a LEAF-row control proving
    // the #editor slot still receives that leaf's own record (never `cellSlotRow`-wrapped —
    // C3 only rewrites the GROUP-ROW case; a leaf row's `row` was never leaked).
    const qtyCell = northRow.locator('[data-col="qty"][data-grid-cell]');
    await qtyCell.click();
    await page.keyboard.press('Enter');
    await expect(container.locator('[data-editorprobe]')).toHaveCount(0, { timeout: 5_000 });

    const leafRow = container.locator('tbody tr[data-group-leaf]').first();
    const leafQtyCell = leafRow.locator('[data-col="qty"][data-grid-cell]');
    await leafQtyCell.click();
    await page.keyboard.press('Enter');
    const leafEditorProbe = container.locator('[data-editorprobe]');
    await expect(leafEditorProbe).toHaveAttribute('data-editorprobe', /^LEAF:/, { timeout: 15_000 });

    // (c) Control: an ordinary LEAF row's #selectCell still reports its own record.
    const leafSelectProbe = leafRow.locator('[data-selectprobe]');
    await expect(leafSelectProbe).toHaveAttribute('data-selectprobe', /^LEAF:/, { timeout: 15_000 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// C1 (quick 260906-cvo, Task 2) — a group-header row is not editable; Enter toggles the
// group instead. Same fixture as C3 (DataTableGroupEditGuard). Each sub-case starts from a
// fresh page.goto so a prior cell's group toggle cannot leak into the next.
// ═══════════════════════════════════════════════════════════════════════════════════
async function gotoGroupEditGuard(page: Page, target: Target) {
  await page.goto(`/?example=DataTableGroupEditGuard&target=${target}`);
  const mount = page.getByTestId('rozie-mount');
  await expect(mount).toBeVisible();
  const container = mount.getByTestId('grid-table');
  await expect(container.locator('table')).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => mount.getByTestId('grouping-readout').textContent(), { timeout: 15_000 })
    .toBe('region');
  await expect
    .poll(async () => container.locator('tbody tr[data-group-header]').count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
  const northRow = container.locator('tbody tr[data-group-header]').filter({
    has: page.locator('.rdt-group-value', { hasText: 'North' }),
  });
  await expect(northRow).toHaveCount(1, { timeout: 15_000 });
  return { mount, container, northRow };
}

for (const target of TARGETS) {
  runnerFor(target)(`grouped-defs C1 [${target}]: a group-header row is not editable; Enter toggles the group instead`, async ({
    page,
  }) => {
    // (a) Enter on the group row's 'product' cell: opens NO editor, TOGGLES the group
    // (aria-expanded flips), and writes NOTHING (model-readout/commit-count unchanged).
    {
      const { mount, container, northRow } = await gotoGroupEditGuard(page, target);
      const beforeExpanded = await northRow.getAttribute('aria-expanded');
      const productCell = northRow.locator('[data-col="product"][data-grid-cell]');
      await productCell.click();
      await page.keyboard.press('Enter');
      await expect(container.locator('[data-editing-cell]')).toHaveCount(0, { timeout: 5_000 });
      await expect(northRow).toHaveAttribute(
        'aria-expanded',
        beforeExpanded === 'true' ? 'false' : 'true',
        { timeout: 5_000 },
      );
      await expect(mount.getByTestId('model-readout')).toHaveText(
        'Apple:1|Pear:2|Plum:3|Fig:4|Date:5|Lime:6',
      );
      await expect(mount.getByTestId('commit-count')).toHaveText('0');
    }

    // (b) F2 on the group row's 'product' cell: opens NO editor.
    {
      const { container, northRow } = await gotoGroupEditGuard(page, target);
      const productCell = northRow.locator('[data-col="product"][data-grid-cell]');
      await productCell.click();
      await page.keyboard.press('F2');
      await expect(container.locator('[data-editing-cell]')).toHaveCount(0, { timeout: 5_000 });
    }

    // (c) A printable key on the group row's 'product' cell: opens NO editor.
    {
      const { container, northRow } = await gotoGroupEditGuard(page, target);
      const productCell = northRow.locator('[data-col="product"][data-grid-cell]');
      await productCell.click();
      await page.keyboard.press('a');
      await expect(container.locator('[data-editing-cell]')).toHaveCount(0, { timeout: 5_000 });
    }

    // (d) singleClickEdit ON: a single click on the group row's editable cell opens NO
    // editor (the same click on a leaf row, case (e)'s control, still opens one via F2 —
    // singleClickEdit's own click-to-edit path is covered here on the group row only, the
    // defect this guard closes).
    {
      const { mount, container, northRow } = await gotoGroupEditGuard(page, target);
      await mount.getByTestId('toggle-single-click-edit').click();
      await expect(mount.getByTestId('single-click-edit-state')).toHaveText('on');
      const productCell = northRow.locator('[data-col="product"][data-grid-cell]');
      await productCell.click();
      await expect(container.locator('[data-editing-cell]')).toHaveCount(0, { timeout: 5_000 });
    }

    // (e) Control: an ordinary LEAF row's 'product' cell is UNAFFECTED — F2 still opens its
    // editor, typing still seeds/replaces the draft, and Enter-to-commit still writes the
    // model and bumps commit-count.
    {
      const { mount, container } = await gotoGroupEditGuard(page, target);
      const leafRow = container.locator('tbody tr[data-group-leaf]').first();
      const productCell = leafRow.locator('[data-col="product"][data-grid-cell]');
      await productCell.click();
      await page.keyboard.press('F2');
      const editorInput = container.locator('[data-editing-cell]');
      await expect(editorInput).toHaveCount(1, { timeout: 5_000 });
      await expect(editorInput).toBeFocused({ timeout: 5_000 });
      await page.keyboard.type('Zeta');
      await page.keyboard.press('Enter');
      await expect(mount.getByTestId('commit-count')).toHaveText('1', { timeout: 5_000 });
      await expect(mount.getByTestId('model-readout')).toHaveText(
        'Zeta:1|Pear:2|Plum:3|Fig:4|Date:5|Lime:6',
        { timeout: 5_000 },
      );
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// C2 (quick 260906-cvo, Task 3) — paste, cut, clear and fill never write through a
// group-header row. Same fixture as C1/C3 (DataTableGroupEditGuard). Helpers copied
// verbatim from data-table-grid-clipboard.spec.ts (readoutText / focusBodyCell /
// focusBodyCellStable / activeCellCoords / extendRangeBy / fillDragTo).
// ═══════════════════════════════════════════════════════════════════════════════════

/** Read a readout testid's trimmed text (shadow-pierced). */
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

/** The active cell's [data-row]/[data-col-index], shadow-pierced. */
async function activeCellCoords(page: Page): Promise<{ row: string | null; col: string | null } | null> {
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
    };
  });
}

/** Focus a body cell directly by (row, col) — drives @focusin -> activeRow/activeColIndex sync. */
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

/** Build a range from the active cell by pressing Shift+<dir> `steps` times, then wait for
 *  @range-change to flush the moving focus corner to (toRow,toCol). */
async function extendRangeBy(page: Page, dir: 'Right' | 'Left' | 'Down' | 'Up', steps: number, toRow: number, toCol: number): Promise<void> {
  for (let i = 0; i < steps; i++) await page.keyboard.press(`Shift+Arrow${dir}`);
  await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe(`${toRow},${toCol}`);
}

/** Drive a fill-handle drag to the cell (toRow,toCol) — pointerdown on [data-fill-handle],
 *  a document pointermove to the target cell's center, wait for @range-change to flush, then
 *  a document pointerup (-> fillRange). Coordinates come from getBoundingClientRect. */
async function fillDragTo(page: Page, toRow: number, toCol: number): Promise<void> {
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

// Column indices in DataTableGroupEditGuardDemo (select=0, region=1, product=2, qty=3).
// Row indices (absolute, over $data.rows incl. group rows): 0=North-header, 1=Apple,
// 2=Pear, 3=Plum, 4=South-header, 5=Fig, 6=Date, 7=Lime.
const PRODUCT_COL = 2;

for (const target of TARGETS) {
  runnerFor(target)(`grouped-defs C2 [${target}]: paste/cut/clear/fill never write through a group-header row`, async ({
    page,
  }) => {
    // (a) A 1x1 paste anchored ON the North group-header row's 'product' cell writes
    // NOTHING: model-readout unchanged, commit-count 0, the announce reports zero written.
    {
      const { mount } = await gotoGroupEditGuard(page, target);
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.evaluate(() => navigator.clipboard.writeText('Zzz'));
      await focusBodyCellStable(page, 0, PRODUCT_COL);
      await page.keyboard.press('Control+v');
      await expect(mount.getByTestId('commit-count')).toHaveText('0', { timeout: 5_000 });
      await expect(mount.getByTestId('model-readout')).toHaveText(
        'Apple:1|Pear:2|Plum:3|Fig:4|Date:5|Lime:6',
      );
      await expect
        .poll(async () => readoutText(page, 'paste-announce'), { timeout: 5_000 })
        .toBe('No cells pasted — 1 cells were invalid or read-only');
    }

    // (b) A range spanning the 3 North leaf rows AND the South group-header row
    // (Delete-clear) writes ONLY the 3 leaf cells: commit-count === 3 (N < M=4 total
    // targets), the leaf products blank, the South-header's own leaked record untouched.
    {
      const { mount } = await gotoGroupEditGuard(page, target);
      await focusBodyCellStable(page, 1, PRODUCT_COL);
      await extendRangeBy(page, 'Down', 3, 4, PRODUCT_COL);
      await page.keyboard.press('Delete');
      await expect(mount.getByTestId('commit-count')).toHaveText('3', { timeout: 5_000 });
      await expect(mount.getByTestId('model-readout')).toHaveText(
        ':1|:2|:3|Fig:4|Date:5|Lime:6',
        { timeout: 5_000 },
      );
      await expect
        .poll(async () => readoutText(page, 'paste-announce'), { timeout: 5_000 })
        .toBe('3 of 4 cells pasted');
    }

    // (c) Control: the IDENTICAL Delete-clear operation anchored ENTIRELY on leaf rows
    // (the 3 North leaves — no group row in range) writes EVERY cell.
    {
      const { mount } = await gotoGroupEditGuard(page, target);
      await focusBodyCellStable(page, 1, PRODUCT_COL);
      await extendRangeBy(page, 'Down', 2, 3, PRODUCT_COL);
      await page.keyboard.press('Delete');
      await expect(mount.getByTestId('commit-count')).toHaveText('3', { timeout: 5_000 });
      await expect(mount.getByTestId('model-readout')).toHaveText(
        ':1|:2|:3|Fig:4|Date:5|Lime:6',
        { timeout: 5_000 },
      );
      await expect
        .poll(async () => readoutText(page, 'paste-announce'), { timeout: 5_000 })
        .toBe('3 of 3 cells pasted');
    }

    // (d) Fill-drag: a true 1x1 SOURCE at Plum's 'product' cell (row 3) dragged DOWN across
    // the South group-header row (row 4) writes ONLY the source cell itself (a self-write,
    // same value) — the group row is SKIPPED. commit-count is the unambiguous discriminator
    // here: a fill-drag across a group row happens to write the group row's leaked record
    // with the SAME value the source cell already holds, so model-readout alone cannot tell
    // the two apart.
    {
      const { mount } = await gotoGroupEditGuard(page, target);
      await focusBodyCellStable(page, 3, PRODUCT_COL);
      await extendRangeBy(page, 'Down', 1, 4, PRODUCT_COL);
      await extendRangeBy(page, 'Up', 1, 3, PRODUCT_COL); // back to a true 1x1 range at row 3
      await fillDragTo(page, 4, PRODUCT_COL); // drag DOWN across the South group-header row
      await expect(mount.getByTestId('commit-count')).toHaveText('1', { timeout: 5_000 });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// C4 (quick 260906-cvo, Task 4) — groupSubRowCount counts TRUE leaf records under
// MULTI-LEVEL grouping, not intermediate group nodes. Same fixture as B2
// (DataTableGroupPlaceholder, grouped by ['region','city']).
// ═══════════════════════════════════════════════════════════════════════════════════

/**
 * Ground-truth measurement (never assumed): walk the flattened `tbody tr` rows and, starting
 * from the depth-0 group-header row whose `data-group-header` value starts with
 * `topLevelPrefix`, count DESCENDANTS (every row until the next depth-0 row) split into true
 * leaf records (`[data-group-leaf]`) vs intermediate group nodes (`[data-group-header]` at a
 * deeper level).
 */
async function measureGroupDescendants(
  page: Page,
  containerTestId: string,
  topLevelPrefix: string,
): Promise<{ leafCount: number; groupNodeCount: number }> {
  return page.evaluate(
    ({ cid, prefix }) => {
      const find = (root: Document | ShadowRoot, sel: string): Element | null => {
        const direct = root.querySelector(sel);
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) { const inner = find(sr, sel); if (inner) return inner; }
        }
        return null;
      };
      // Shadow-piercing collection (Lit's <table> lives inside the DataTable custom
      // element's OWN shadow root, nested under the light-DOM container found above —
      // container.querySelectorAll alone does not cross that boundary).
      const collectAll = (root: Document | ShadowRoot | Element, sel: string): Element[] => {
        const out = Array.from(root.querySelectorAll(sel));
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) out.push(...collectAll(sr, sel));
        }
        return out;
      };
      const container = find(document, `[data-testid="${cid}"]`);
      const rows = container ? collectAll(container, 'tbody tr') : [];
      let leafCount = 0;
      let groupNodeCount = 0;
      let inSpan = false;
      for (const row of rows) {
        const gh = row.getAttribute('data-group-header');
        const depth = row.getAttribute('data-depth');
        if (gh != null && depth === '0') {
          inSpan = gh.indexOf(prefix) === 0;
          continue;
        }
        if (!inSpan) continue;
        if (row.getAttribute('data-group-leaf') != null) leafCount += 1;
        else if (gh != null) groupNodeCount += 1;
      }
      return { leafCount, groupNodeCount };
    },
    { cid: containerTestId, prefix: topLevelPrefix },
  );
}

for (const target of TARGETS) {
  runnerFor(target)(`grouped-defs C4 [${target}]: groupSubRowCount counts true leaf records under multi-level grouping`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGroupPlaceholder&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const container = mount.getByTestId('placeholder-table');
    await expect(container.locator('table')).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => mount.getByTestId('grouping-readout').textContent(), { timeout: 15_000 })
      .toBe('region,city');
    await expect
      .poll(async () => container.locator('tbody tr[data-group-header]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // Ground truth, measured from the live DOM (not assumed): North's true leaf records vs
    // its intermediate city sub-group nodes.
    const { leafCount, groupNodeCount } = await measureGroupDescendants(page, 'placeholder-table', 'region:North');
    expect(groupNodeCount).toBeGreaterThan(0); // sanity: multi-level grouping is genuinely engaged

    const northRow = container.locator('tbody tr[data-group-header]').filter({
      has: page.locator('.rdt-group-value', { hasText: 'North' }),
    });
    await expect(northRow).toHaveCount(1, { timeout: 15_000 });

    // The rendered count chip reports the MEASURED true-record count (leafCount), never
    // leafCount + groupNodeCount (the over-count this task fixes).
    await expect(northRow.locator('.rdt-group-count')).toHaveText(`(${leafCount})`, { timeout: 15_000 });

    // The #cell slot's descriptor `leafCount` field (via data-rowprobe's trailing segment)
    // reports the SAME measured value — groupRowDescriptor's leafCount reuses
    // groupSubRowCount(row) verbatim.
    const productProbe = northRow.locator('[data-col="product"] [data-testid="cell-display"]');
    await expect(productProbe).toHaveAttribute('data-rowprobe', `GROUP:region:North:${leafCount}`, {
      timeout: 15_000,
    });
  });
}
