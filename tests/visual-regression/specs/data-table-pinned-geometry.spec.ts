import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260922-mkb — A-06, RED-first. A pinned column's sticky offset must equal the RENDERED
 * width of the pinned columns before it.
 *
 * `pinStyle()` takes the offset from table-core's size model (`getStart('left')`), but outside
 * the column-windowed path the cells were content-box, so the cell padding rendered ON TOP of
 * the declared width. Measured on DataTableVirtualStickySelect: the select rail renders 58.2px
 * (34.2px content + 12px + 12px padding) while the pinned `name` column sticks at `left: 44px`,
 * so once the table scrolls horizontally `name` overlaps the rail by 14.2px — and each further
 * pinned column compounds it. Asserted as the geometric contract the sticky math depends on,
 * on the header row AND a body row, scroll-independent.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return built ? test : test.fixme;
}

/** For the last header row and the first rendered body data row: each left-pinned cell's
 *  computed `left` and the sum of the rendered widths of the pinned cells before it. */
async function pinnedOffsets(page: Page): Promise<Array<{ row: string; left: number; expected: number }>> {
  return page.evaluate(() => {
    const deepAll = (sel: string, root: Document | ShadowRoot = document): Element[] => {
      let out = Array.from(root.querySelectorAll(sel));
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) out = out.concat(deepAll(sel, sr));
      }
      return out;
    };
    const rows: Array<[string, Element | undefined]> = [
      ['head', deepAll('thead tr').pop()],
      ['body', deepAll('tbody tr').find((r) => r.querySelector('[data-grid-cell], td + td'))],
    ];
    const out: Array<{ row: string; left: number; expected: number }> = [];
    for (const [label, row] of rows) {
      if (!row) continue;
      let acc = 0;
      for (const cell of Array.from(row.children)) {
        const cs = getComputedStyle(cell);
        if (cs.position !== 'sticky' || cs.left === 'auto') break;
        out.push({ row: label, left: parseFloat(cs.left), expected: acc });
        acc += cell.getBoundingClientRect().width;
      }
    }
    return out;
  });
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table-pinned-geometry [${target}]: A-06 a pinned column sticks exactly past the pinned columns before it`, async ({ page }) => {
    await page.goto(`/?example=DataTableVirtualStickySelect&target=${target}`);
    await expect(page.getByTestId('rozie-mount').locator('table').first()).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => (await pinnedOffsets(page)).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(4);
    const offsets = await pinnedOffsets(page);
    // select rail + the pinned `name` column, on both rows.
    for (const o of offsets) {
      expect(Math.abs(o.left - o.expected), `${o.row}: left=${o.left} expected=${o.expected}`).toBeLessThanOrEqual(0.5);
    }
  });
}
