import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260925-rid (oinbox dogfooding) — `getRowId` keys selection and expansion to the row.
 * examples/demos/DataTableRowIdDemo.rozie seeds rowSelection { b: true } + expanded
 * { b: true } with getRowId = row => row.id, then prepends a row. Without getRowId the keys
 * are row indices: the seed selects nothing, and an insert shifts any selection onto the
 * row that now sits at that index.
 */
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const table = (page: Page) => page.getByTestId('rozie-mount').getByTestId('rowid-table');
const rowOf = (page: Page, name: string) =>
  table(page).locator('tbody tr').filter({ has: page.locator('td', { hasText: new RegExp(`^\\s*${name}\\s*$`) }) });
const checked = (page: Page, name: string) => rowOf(page, name).locator('input.rdt-select-row');

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  (built ? test : test.fixme)(`data-table getRowId [${target}]: selection + expansion stay on the row across an insert at the top`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableRowId&target=${target}`);
    await expect(table(page).locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const expectBravoOnly = async () => {
      await expect(checked(page, 'Bravo')).toBeChecked();
      for (const other of ['Alpha', 'Charlie']) await expect(checked(page, other)).not.toBeChecked();
      await expect(table(page).getByTestId('detail')).toHaveCount(1);
      await expect(table(page).getByTestId('detail')).toHaveText('detail Bravo');
    };

    // The id-keyed seed lands on Bravo.
    await expectBravoOnly();

    // A row arrives at the top: Bravo is still the selected, expanded row.
    await page.getByTestId('insert-top').click();
    await expect(rowOf(page, 'Zulu')).toHaveCount(1);
    await expectBravoOnly();
    await expect(checked(page, 'Zulu')).not.toBeChecked();

    // A click after the insert is keyed by id too.
    await checked(page, 'Charlie').check();
    await expect(page.getByTestId('readout-selected')).toHaveText('b,c');
  });
}
