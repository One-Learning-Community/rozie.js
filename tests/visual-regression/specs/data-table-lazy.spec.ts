import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260925-dtl part 2 (oinbox dogfooding) — virtual lazy loading.
 * examples/demos/DataTableLazyDemo.rozie: virtual + manual + rowCount 10,000 over sparse data
 * (rows 0–49 loaded). Asserts: the row space is rowCount long; `visible-range-change` reports
 * the rendered window (incl. overscan) at mount and after a scroll; holes render as
 * placeholder rows (aria-busy); filling the reported window replaces them in place without the
 * scroll position moving; select-all selects loaded rows only.
 */
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const table = (page: Page) => page.getByTestId('rozie-mount').getByTestId('lazy-table');
const scroller = (page: Page) => table(page).locator('.rdt-scroll');
const rangeOf = async (page: Page) => {
  const t = (await page.getByTestId('range').textContent()) ?? '';
  const [s, e] = t.split('-').map(Number);
  return { start: s ?? NaN, end: e ?? NaN };
};

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  (built ? test : test.fixme)(`data-table lazy [${target}]: rowCount-long sparse rows, visible-range-change, placeholders fill in place`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableLazy&target=${target}`);
    await expect(table(page).locator('tbody tr[data-row]').first()).toBeVisible({ timeout: 15_000 });

    // The scroll space is rowCount rows long (~10,000 x 40px), not the 50 loaded rows.
    const scrollH = await scroller(page).evaluate((el) => el.scrollHeight);
    expect(scrollH).toBeGreaterThan(300_000);

    // The initial rendered window is reported at mount.
    await expect(page.getByTestId('range')).toHaveText(/^0-\d+$/, { timeout: 5_000 });
    expect((await rangeOf(page)).end).toBeGreaterThan(5);

    // Scroll to the middle: the report follows, and the unloaded rows are placeholders.
    await scroller(page).evaluate((el) => { el.scrollTop = 5000 * 40; });
    await expect.poll(async () => (await rangeOf(page)).start, { timeout: 5_000 }).toBeGreaterThan(4900);
    const r = await rangeOf(page);
    expect(r.start).toBeLessThanOrEqual(5000);
    expect(r.end).toBeGreaterThan(5005);
    await expect(table(page).locator('tbody tr[aria-busy="true"]').first()).toBeVisible();

    // Fill exactly the reported window: placeholders become rows in place, the view does not move.
    // The anchor is what the user sees: the first row in view and its offset from the viewport
    // top. (scrollTop itself may legitimately change — rows filled ABOVE the viewport re-measure
    // and the virtualizer compensates so the visible content stays put.)
    const anchorOf = () => scroller(page).evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const rows = Array.from(el.querySelectorAll('tbody tr[data-row]')) as HTMLElement[];
      const first = rows.find((r) => r.getBoundingClientRect().bottom > top + 1);
      return first ? { row: first.getAttribute('data-row'), offset: first.getBoundingClientRect().top - top } : null;
    });
    // The baseline must be read after the SCROLL's own remeasure has converged, not merely once
    // the range report arrives (that is estimate arithmetic). Under CPU load (Docker, 3 workers)
    // the report can beat convergence: 2 of 500 runs read a mid-convergence {5000, -12.5}, the
    // fill then finished that convergence at the settled {4999, -32.5} every other run already
    // had, and the anchor check blamed the fill. Wait for two identical reads 100ms apart.
    let before: Awaited<ReturnType<typeof anchorOf>> = null;
    await expect.poll(async () => {
      const a = await anchorOf();
      const settled = !!a && !!before && a.row === before.row && Math.abs(a.offset - before.offset) < 0.5;
      before = a;
      return settled;
    }, { intervals: [100], timeout: 5_000 }).toBe(true);
    await page.getByTestId('load-range').click();
    await expect(table(page).locator('tbody td', { hasText: /^\s*Row 5000\s*$/ })).toBeVisible();
    await expect.poll(async () => {
      const a = await anchorOf();
      return a && before && a.row === before.row && Math.abs(a.offset - before.offset) <= 1;
    }, { timeout: 3_000 }).toBe(true);

    // Filled rows are MEASURED; where their height differs from the placeholder estimate the
    // rendered window can shift (async-commit targets do). The table must then REPORT the new
    // window — a consumer fetching on every visible-range-change converges to no placeholders.
    // (Measured on React: the window moved 4993-5021 -> 4991-5015 after the first fill.)
    const busy = table(page).locator('tbody tr[aria-busy="true"]');
    for (let round = 0; round < 5 && (await busy.count()) > 0; round++) {
      await page.getByTestId('load-range').click();
      await page.waitForTimeout(150);
    }
    await expect(busy).toHaveCount(0);
    // The last report covers what is rendered now.
    const rendered = await table(page).locator('tbody tr[data-row]').evaluateAll((rs) => rs.map((x) => Number(x.getAttribute('data-row'))));
    const last = await rangeOf(page);
    expect(Math.min(...rendered)).toBeGreaterThanOrEqual(last.start);
    expect(Math.max(...rendered)).toBeLessThan(last.end);

    // Select-all takes the LOADED rows only (50 + the filled window), never the holes.
    await table(page).locator('input.rdt-select-all').check();
    // Exactly the loaded rows — never a placeholder.
    const loaded = (await page.getByTestId('loaded-count').textContent()) ?? '';
    expect(Number(loaded)).toBeGreaterThanOrEqual(50 + (r.end - r.start));
    await expect(page.getByTestId('selected-count')).toHaveText(loaded);
  });
}
