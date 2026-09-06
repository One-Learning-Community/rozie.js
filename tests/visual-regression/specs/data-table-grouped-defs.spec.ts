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
 *      `LEAF:Apple` (leaf #1's record). GREEN: it reports `GROUP:region:North:5` (the
 *      locked descriptor shape; `leafCount` REUSES the pre-existing `groupSubRowCount(row)`
 *      helper verbatim per the plan's key_links, which — under MULTI-LEVEL grouping —
 *      recursively flattens `row.subRows` via table-core's `getLeafRows()` WITHOUT filtering
 *      out intermediate group nodes, so North's count is its 2 city sub-groups (Oslo,
 *      Bergen) PLUS their 3 actual leaf records = 5, not the 3 true records. This is a
 *      pre-existing `groupSubRowCount` quirk — unrelated to and out of scope for this task
 *      — reused as-is per the locked contract; verified against the live DOM, not assumed).
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
    // descriptor, so rowProbe(row) resolves 'GROUP:region:North:5' (leafCount reuses
    // groupSubRowCount(row) verbatim — see the file-header doc comment for why North's
    // count is 5, not the 3 true leaf records).
    const productProbe = northRow.locator('[data-col="product"] [data-testid="cell-display"]');
    await expect(productProbe).toHaveAttribute('data-rowprobe', 'GROUP:region:North:5', {
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
