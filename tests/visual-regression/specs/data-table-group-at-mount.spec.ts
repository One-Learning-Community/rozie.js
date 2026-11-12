import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 1.0 surface freeze Task 7b — a model slice bound to a non-empty value from the FIRST render
 * is applied at mount on every target. The bug: `grouping` bound at mount rendered no group
 * rows on React/Solid/Lit (the <Column> children register after the first row-model pull, and
 * table-core's grouped stage does not key on the column set). The other slices are checked at
 * mount too. DOM assertions only (no PNG baselines).
 */
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return !built ? test.fixme : test;
}

for (const target of TARGETS) {
  test.describe(`data-table-group-at-mount [${target}]`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/?example=DataTableGroupAtMount&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();
    });

    for (const id of ['grouping-two-way', 'grouping-one-way']) {
      runnerFor(target)(`${id}: grouping ['category'] at mount renders two group rows`, async ({ page }) => {
        const table = page.getByTestId('rozie-mount').getByTestId(id);
        const headers = table.locator('[data-group-header]');
        await expect(headers).toHaveCount(2, { timeout: 15_000 });
        await expect(headers.nth(0)).toContainText('Fruit');
        await expect(headers.nth(1)).toContainText('Veg');
        // Auto-expanded (expanded unbound + grouping active) → all four leaves visible.
        await expect(table.locator('[data-group-leaf]')).toHaveCount(4, { timeout: 10_000 });
      });
    }

    runnerFor(target)('sorting [{name desc}] at mount sorts the body', async ({ page }) => {
      const table = page.getByTestId('rozie-mount').getByTestId('sorting-bound');
      const names = table.locator('tbody td[data-col="name"]');
      await expect(names).toHaveCount(4, { timeout: 15_000 });
      await expect(names).toHaveText(['Pea', 'Carrot', 'Banana', 'Apple']);
    });

    runnerFor(target)('columnFilters [{category Veg}] at mount filters the body', async ({ page }) => {
      const table = page.getByTestId('rozie-mount').getByTestId('filters-bound');
      const names = table.locator('tbody td[data-col="name"]');
      await expect(names).toHaveText(['Carrot', 'Pea'], { timeout: 15_000 });
    });

    runnerFor(target)("expanded {'0': true} at mount shows row 0's detail", async ({ page }) => {
      const table = page.getByTestId('rozie-mount').getByTestId('expanded-bound');
      await expect(table.locator('[data-detail-row]')).toHaveCount(1, { timeout: 15_000 });
      await expect(table.getByTestId('at-mount-detail')).toHaveText('Detail Apple');
    });

    runnerFor(target)('columnPinning {left:[qty]} at mount pins qty first', async ({ page }) => {
      const table = page.getByTestId('rozie-mount').getByTestId('pinning-bound');
      const firstRowCells = table.locator('tbody tr.rdt-tr').first().locator('td[data-col]');
      await expect(firstRowCells).toHaveCount(2, { timeout: 15_000 });
      await expect(firstRowCells.nth(0)).toHaveAttribute('data-col', 'qty');
      await expect(firstRowCells.nth(0)).toHaveClass(/rdt-pinned/);
    });

    runnerFor(target)('columnVisibility {qty:false} at mount hides qty', async ({ page }) => {
      const table = page.getByTestId('rozie-mount').getByTestId('visibility-bound');
      await expect(table.locator('tbody td[data-col="name"]')).toHaveCount(4, { timeout: 15_000 });
      expect(await table.locator('[data-col="qty"]').count()).toBe(0);
    });
  });
}
