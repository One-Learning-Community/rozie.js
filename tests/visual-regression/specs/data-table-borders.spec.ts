import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Border model (examples/demos/DataTableBordersDemo.rozie, ?example=DataTableBorders).
 *
 *   B1 — the table uses separate borders with zero spacing, so a sticky or pinned cell's
 *        borders travel with it instead of staying in the scrolling grid (the 1px gap).
 *   B2 — each cell resets its borders: a host's plain `table td, table th { border }` rule
 *        (injected below; it can't reach Lit's shadow root, which is fine) draws nothing
 *        inside the table except the row line the table itself owns.
 *   B3 — pinned body cells are opaque, so scrolled content never shows through them.
 *   B4 — the opt-in columnLines prop draws a right line on every cell, a left line on the
 *        first column and a top line on the header row; inner cells get no left line.
 *   B5 — the range tint stays visible on a pinned cell (layered over its opaque background).
 *   B6 — the group-row band stays visible on a pinned cell.
 *   B7 — pinned filter-row cells are opaque (with the filter-row band layered on top).
 *   B8 — column lines follow the writing direction: under dir="rtl" the outer line sits on the
 *        right of the first cell and each cell's separator on its left.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

const HOST_RULE = 'table td, table th { border: 1px solid rgb(255, 0, 0); }';

interface CellStyle {
  bl: string; bt: string; br: string; bb: string; bg: string; bgImage: string; collapse: string; spacing: string;
}

/** Computed style of a grid cell picked by selector, shadow-pierced. */
async function cellStyle(page: Page, selector: string): Promise<CellStyle | null> {
  return page.evaluate((sel) => {
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
    const cell = grid.querySelector(sel);
    if (!cell) return null;
    const cs = getComputedStyle(cell);
    const ts = getComputedStyle(grid);
    return {
      bl: cs.borderLeftWidth, bt: cs.borderTopWidth, br: cs.borderRightWidth, bb: cs.borderBottomWidth,
      bg: cs.backgroundColor, bgImage: cs.backgroundImage,
      collapse: ts.borderCollapse, spacing: ts.borderSpacing,
    };
  }, selector);
}

async function gotoBorders(page: Page, target: Target, injectHostRule: boolean) {
  if (injectHostRule) {
    await page.addInitScript((css) => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = css;
        document.head.appendChild(s);
      });
    }, HOST_RULE);
  }
  await page.goto(`/?example=DataTableBorders&target=${target}`);
  const mount = page.getByTestId('rozie-mount');
  await expect(mount).toBeVisible();
  await expect(mount.locator('table[role="grid"]')).toBeVisible({ timeout: 15_000 });
  return mount;
}

// Body cells: a pinned first column, then inner cells.
const PINNED_TD = 'tbody [data-grid-cell][data-row="1"][data-col-index="0"]';
const INNER_TD = 'tbody [data-grid-cell][data-row="1"][data-col-index="3"]';
const HEADER_TH = 'thead th[role="columnheader"]:nth-of-type(4)';

for (const target of TARGETS) {
  runnerFor(target)(`data-table-borders [${target}]: B1 separate borders with zero spacing`, async ({ page }) => {
    await gotoBorders(page, target, false);
    const s = await cellStyle(page, INNER_TD);
    expect(s?.collapse).toBe('separate');
    expect(['0px', '0px 0px']).toContain(s?.spacing);
  });

  runnerFor(target)(`data-table-borders [${target}]: B2 a host table-td border rule draws nothing but the row line`, async ({ page }) => {
    await gotoBorders(page, target, true);
    const s = await cellStyle(page, INNER_TD);
    expect([s?.bl, s?.bt, s?.br, s?.bb]).toEqual(['0px', '0px', '0px', '1px']);
  });

  runnerFor(target)(`data-table-borders [${target}]: B3 pinned body cells are opaque`, async ({ page }) => {
    await gotoBorders(page, target, false);
    const s = await cellStyle(page, PINNED_TD);
    expect(s?.bg).toBe('rgb(255, 255, 255)');
  });

  runnerFor(target)(`data-table-borders [${target}]: B4 columnLines draws right, first-left and header-top lines`, async ({ page }) => {
    const mount = await gotoBorders(page, target, false);
    await mount.getByTestId('toggle-column-lines').check();
    await expect.poll(async () => (await cellStyle(page, INNER_TD))?.br, { timeout: 10_000 }).toBe('1px');
    const first = await cellStyle(page, PINNED_TD);
    expect(first?.bl).toBe('1px');
    expect(first?.br).toBe('1px');
    const inner = await cellStyle(page, INNER_TD);
    expect(inner?.bl).toBe('0px');
    const th = await cellStyle(page, HEADER_TH);
    expect(th?.bt).toBe('1px');
  });

  runnerFor(target)(`data-table-borders [${target}]: B5 range tint stays visible on a pinned cell`, async ({ page }) => {
    await gotoBorders(page, target, false);
    const plain = await cellStyle(page, 'tbody [data-grid-cell][data-row="5"][data-col-index="0"]');
    await page.evaluate((sel) => {
      const findGridTable = (root: Document | ShadowRoot): Element | null => {
        const direct = root.querySelector('table[role="grid"]');
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) { const inner = findGridTable(sr); if (inner) return inner; }
        }
        return null;
      };
      const cell = findGridTable(document)?.querySelector(sel) as HTMLElement | null;
      cell?.focus();
    }, PINNED_TD);
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => page.getByTestId('range-readout').textContent(), { timeout: 10_000 }).toBe('2,0');
    const tinted = await cellStyle(page, PINNED_TD);
    const visible = (tinted?.bgImage ?? 'none') !== 'none' || tinted?.bg !== plain?.bg;
    expect(visible).toBe(true);
  });

  runnerFor(target)(`data-table-borders [${target}]: B6 the group-row band stays visible on a pinned cell`, async ({ page }) => {
    const mount = await gotoBorders(page, target, false);
    await mount.getByTestId('toggle-grouping').click();
    await expect.poll(async () => (await cellStyle(page, 'tr.rdt-group-header > td.rdt-pinned')) !== null, { timeout: 10_000 }).toBe(true);
    const s = await cellStyle(page, 'tr.rdt-group-header > td.rdt-pinned');
    expect(s?.bgImage).not.toBe('none');
  });

  runnerFor(target)(`data-table-borders [${target}]: B7 pinned filter cells are opaque`, async ({ page }) => {
    await gotoBorders(page, target, false);
    const s = await cellStyle(page, '.rdt-filter-cell.rdt-pinned');
    expect(s).not.toBeNull();
    expect(s?.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(s?.bgImage).not.toBe('none');
  });

  runnerFor(target)(`data-table-borders [${target}]: B8 column lines follow the writing direction`, async ({ page }) => {
    const mount = await gotoBorders(page, target, false);
    await mount.getByTestId('toggle-dir').click();
    await mount.getByTestId('toggle-column-lines').check();
    await expect.poll(async () => (await cellStyle(page, INNER_TD))?.bl, { timeout: 10_000 }).toBe('1px');
    const inner = await cellStyle(page, INNER_TD);
    expect(inner?.br).toBe('0px');
    const first = await cellStyle(page, PINNED_TD);
    expect([first?.bl, first?.br]).toEqual(['1px', '1px']);
  });
}
