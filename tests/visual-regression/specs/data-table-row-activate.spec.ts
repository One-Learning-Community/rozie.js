import { test, expect, type Page, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260925-dtl (oinbox dogfooding) — `row-activate { row, index, trigger }`.
 * examples/demos/DataTableRowActivateDemo.rozie. Click on a row outside any control activates
 * it (table + grid mode); the selection checkbox and the expander are controls and do not.
 * Grid mode: Enter on a non-editable cell (with no controls of its own) activates with
 * trigger 'keyboard'; Enter on an editable cell still opens the editor and does not activate.
 */
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const section = (page: Page, id: string) => page.getByTestId('rozie-mount').getByTestId(id);
const rowOf = (t: Locator, name: string) =>
  t.locator('tbody tr').filter({ has: t.page().locator('td', { hasText: new RegExp(`^\\s*${name}\\s*$`) }) });
const cellOf = (t: Locator, name: string) => rowOf(t, name).locator('td', { hasText: new RegExp(`^\\s*${name}\\s*$`) });

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  (built ? test : test.fixme)(`data-table row-activate [${target}]: click activates outside controls; grid Enter activates a non-editable cell only`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableRowActivate&target=${target}`);
    const a = section(page, 'table-a');
    const b = section(page, 'table-b');
    await expect(a.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    const lastA = page.getByTestId('last-a');
    const countA = page.getByTestId('count-a');

    // ── A (table mode): a click on the row's text activates it.
    await cellOf(a, 'Bravo').click();
    await expect(lastA).toHaveText('click:Bravo:1');
    await expect(countA).toHaveText('1');
    // The checkbox and the expander are controls: no activation.
    await rowOf(a, 'Charlie').locator('input.rdt-select-row').click();
    await rowOf(a, 'Alpha').getByRole('button').first().click();
    await expect(countA).toHaveText('1');

    // ── B (grid mode): click, then Enter on a non-editable cell.
    const lastB = page.getByTestId('last-b');
    const countB = page.getByTestId('count-b');
    await cellOf(b, 'Charlie').click();
    await expect(lastB).toHaveText('click:Charlie:2');
    await page.keyboard.press('Enter');
    await expect(lastB).toHaveText('keyboard:Charlie:2');
    await expect(countB).toHaveText('2');

    // Enter on the editable Qty cell opens the editor and does NOT activate.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(rowOf(b, 'Charlie').locator('input')).toHaveCount(1);
    await expect(countB).toHaveText('2');
  });
}
