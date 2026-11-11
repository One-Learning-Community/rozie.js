import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * data-table 0.9.2 (audit C-01) — editing a `getSubRows` child row must never write a
 * DIFFERENT record. A child row's `original` is not in the top-level `data` array, so
 * `sourceIndexOfRow` used to fall back to the VISIBLE index and overwrite whichever
 * top-level record sat there (expanded: [P0, c0a, c0b, P1, P2] -> editing c0a replaced P1).
 *
 * Behaviour asserted (examples/demos/DataTableTreeEditDemo.rozie):
 *  - committing an edit on a child row leaves every top-level record AND every child
 *    untouched, and fires no cell-edit-commit (nothing was written);
 *  - a child row does not open an editor at all (Enter / F2 / double-click);
 *  - a top-level row still edits normally (the guard is not over-broad).
 */
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return built ? test : test.fixme;
}

const table = (page: Page) => page.getByTestId('rozie-mount').getByTestId('tree-table');

async function readout(page: Page, testid: string): Promise<string> {
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

const PRISTINE = [
  { id: 'p0', name: 'Parent 0', kids: ['Child 0a', 'Child 0b'] },
  { id: 'p1', name: 'Parent 1', kids: [] },
  { id: 'p2', name: 'Parent 2', kids: [] },
];

async function open(page: Page, target: Target) {
  await page.goto(`/?example=DataTableTreeEdit&target=${target}`);
  const rows = table(page).locator('tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await table(page).locator('[data-expander]').first().click();
  await expect(table(page).locator('[data-depth="1"]')).toHaveCount(2, { timeout: 10_000 });
  return rows;
}

const editor = (page: Page) => table(page).locator('[data-editing-cell]');

for (const target of TARGETS) {
  runnerFor(target)(`[${target}] editing a getSubRows child row never writes another record`, async ({ page }) => {
    const rows = await open(page, target);
    const child = rows.nth(1);
    await expect(child).toContainText('Child 0a');
    const cell = child.locator('td[data-col="name"]');
    await cell.click();
    // Every entry path: type-to-edit, Enter, F2, double-click, then commit keys. None may open
    // an editor on a child row, and nothing may be written or emitted.
    for (const key of ['H', 'Enter', 'F2']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
      await expect(editor(page)).toHaveCount(0);
    }
    await cell.dblclick();
    await page.waitForTimeout(250);
    await expect(editor(page)).toHaveCount(0);
    expect(JSON.parse(await readout(page, 'model-readout'))).toEqual(PRISTINE);
    expect(await readout(page, 'commit-count')).toBe('0');
  });

  runnerFor(target)(`[${target}] a commit attempted on a child row leaves every record untouched`, async ({ page }) => {
    const rows = await open(page, target);
    await rows.nth(1).locator('td[data-col="name"]').click();
    // Drive the commit path as a user would; whether or not an editor opens, the data must not move.
    await page.keyboard.press('H');
    await page.waitForTimeout(300);
    if ((await editor(page).count()) > 0) {
      await page.keyboard.type('IJACK');
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(400);
    expect(JSON.parse(await readout(page, 'model-readout'))).toEqual(PRISTINE);
    expect(await readout(page, 'commit-count')).toBe('0');
  });

  runnerFor(target)(`[${target}] a top-level row of the same tree still edits`, async ({ page }) => {
    const rows = await open(page, target);
    const top = rows.nth(3); // [P0, c0a, c0b, P1, P2]
    await expect(top).toContainText('Parent 1');
    await top.locator('td[data-col="name"]').click();
    await page.keyboard.press('R'); // type-to-edit seeds the editor with 'R'
    await expect(editor(page)).toHaveCount(1, { timeout: 10_000 });
    await expect.poll(async () => page.evaluate(() => {
      let a = document.activeElement as (Element & { shadowRoot?: ShadowRoot | null }) | null;
      while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement as typeof a; // Lit: cross shadow roots
      return a ? a.tagName.toLowerCase() : '';
    }), { timeout: 10_000 }).toBe('input');
    await page.keyboard.type('enamed');
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => JSON.parse(await readout(page, 'model-readout'))[1].name, { timeout: 10_000 })
      .toBe('Renamed');
    const m = JSON.parse(await readout(page, 'model-readout'));
    expect(m[0]).toEqual(PRISTINE[0]);
    expect(m[2]).toEqual(PRISTINE[2]);
    expect(await readout(page, 'commit-count')).toBe('1');
  });
}
