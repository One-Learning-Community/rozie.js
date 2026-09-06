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
 *      locked descriptor shape). A leaf row's `product` cell still reports `LEAF:<product>`.
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
