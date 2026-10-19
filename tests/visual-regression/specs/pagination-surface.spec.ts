import { test, expect, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Pagination surface coverage (quick 261018-vdu) — the parts of the `Pagination`
 * surface that `pagination.spec.ts` (the PaginationBehavior pager) does not reach:
 * the imperative handle, `change` firing rules, siblingCount / boundaryCount,
 * the `total` + `pageSize` page-count source, `disabled`, `ariaLabel`, the four
 * scoped slots and their params, and roving keyboard focus.
 *
 * `examples/demos/PaginationSurfaceDemo.rozie` mounts five pagers (A..E); each is
 * addressed through its `nav` landmark by `ariaLabel`, which doubles as the
 * ariaLabel assertion. Behavioural assertions only — no `toHaveScreenshot`.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const nav = (page: Page, name: string) => page.getByRole('navigation', { name, exact: true });
const text = async (loc: Locator) => (await loc.textContent())?.trim() ?? '';
/** The accessible names of a pager's controls, in DOM order. */
const controlNames = (n: Locator) =>
  n.locator('[data-page-control]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
/** The deepest focused element's aria-label (walks open shadow roots, for Lit). */
const focusedLabel = (page: Page) =>
  page.evaluate(() => {
    let a: any = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a ? (a.getAttribute?.('aria-label') ?? a.tagName) : null;
  });

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;

  runner(`pagination surface [${target}]: total + pageSize derive the page count; ariaLabel names the landmark; windowing follows siblingCount / boundaryCount`, async ({
    page,
  }) => {
    await page.goto(`/?example=PaginationSurface&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // A: 195 items / 10 per page = 20 pages, seeded at page 10 -> 1 … 9 10 11 … 20.
    const a = nav(page, 'Pager A');
    await expect(a).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => controlNames(a), { timeout: 10_000 }).toEqual([
      'Previous page', 'Go to page 1', 'Go to page 9', 'Go to page 10', 'Go to page 11', 'Go to page 20', 'Next page',
    ]);

    // B: siblingCount 0 + boundaryCount 2 over 10 pages at page 5 -> 1 2 … 5 … 9 10.
    const b = nav(page, 'Pager B');
    await expect.poll(() => controlNames(b), { timeout: 10_000 }).toEqual([
      'Previous page', 'Go to page 1', 'Go to page 2', 'Go to page 5', 'Go to page 9', 'Go to page 10', 'Next page',
    ]);

    // E: a single page still renders (the page count floors at 1), both steppers off.
    const e = nav(page, 'Pager E');
    await expect.poll(() => controlNames(e), { timeout: 10_000 }).toEqual([
      'Previous page', 'Go to page 1', 'Next page',
    ]);
    await expect(e.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await expect(e.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  runner(`pagination surface [${target}]: handle verbs — goto clamps, first/last/next/prev honour the bounds, and change fires only on a real move`, async ({
    page,
  }) => {
    await page.goto(`/?example=PaginationSurface&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const pageOut = page.getByTestId('a-page');
    const changes = page.getByTestId('a-change-count');
    const last = page.getByTestId('a-last-change');
    const a = nav(page, 'Pager A');
    await expect(a).toBeVisible({ timeout: 15_000 });
    expect(await text(pageOut)).toBe('10');
    expect(await text(changes)).toBe('0');

    // goto(current) is not a move: no change event.
    await page.getByTestId('a-goto-same').click();
    await page.waitForTimeout(300);
    expect(await text(changes)).toBe('0');

    // goto(999) clamps to the last page; goto(0) clamps to the first.
    await page.getByTestId('a-goto-far').click();
    await expect.poll(() => text(pageOut), { timeout: 10_000 }).toBe('20');
    expect(await text(last)).toBe('20');
    await expect(a.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await expect(a.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    await page.getByTestId('a-goto-zero').click();
    await expect.poll(() => text(pageOut), { timeout: 10_000 }).toBe('1');
    await expect(a.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    // prev() at page 1 and next() at the last page are no-ops (no change event).
    const before = await text(changes);
    await page.getByTestId('a-prev').click();
    await page.waitForTimeout(300);
    expect(await text(pageOut)).toBe('1');
    expect(await text(changes)).toBe(before);

    // next / last / first / prev move one step or to the ends.
    await page.getByTestId('a-next').click();
    await expect.poll(() => text(pageOut), { timeout: 10_000 }).toBe('2');
    await page.getByTestId('a-last').click();
    await expect.poll(() => text(pageOut), { timeout: 10_000 }).toBe('20');
    const atLast = await text(changes);
    await page.getByTestId('a-next').click();
    await page.waitForTimeout(300);
    expect(await text(pageOut)).toBe('20');
    expect(await text(changes)).toBe(atLast);
    await page.getByTestId('a-prev').click();
    await expect.poll(() => text(pageOut), { timeout: 10_000 }).toBe('19');
    await page.getByTestId('a-first').click();
    await expect.poll(() => text(pageOut), { timeout: 10_000 }).toBe('1');

    // Clicking the already-active page button is not a move either.
    const beforeActive = await text(changes);
    await a.getByRole('button', { name: 'Go to page 1' }).click();
    await page.waitForTimeout(300);
    expect(await text(changes)).toBe(beforeActive);
  });

  runner(`pagination surface [${target}]: disabled disables every control and suppresses change`, async ({ page }) => {
    await page.goto(`/?example=PaginationSurface&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const c = nav(page, 'Pager C');
    await expect(c).toBeVisible({ timeout: 15_000 });
    const buttons = c.locator('[data-page-control]');
    const n = await buttons.count();
    expect(n).toBeGreaterThan(2);
    for (let i = 0; i < n; i++) {
      await expect(buttons.nth(i)).toBeDisabled();
      await expect(buttons.nth(i)).toHaveAttribute('aria-disabled', 'true');
    }
    // A forced click on a (disabled) page button changes nothing.
    await c.getByRole('button', { name: 'Go to page 4' }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    expect(await text(page.getByTestId('c-change-count'))).toBe('0');
    await expect(c.locator('[aria-current="page"]')).toHaveText('3');
  });

  runner(`pagination surface [${target}]: scoped slots item / ellipsis / prevControl / nextControl receive their params`, async ({
    page,
  }) => {
    await page.goto(`/?example=PaginationSurface&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const d = nav(page, 'Pager D');
    await expect(d).toBeVisible({ timeout: 15_000 });
    const pageOut = page.getByTestId('d-page');

    // Seeded at page 5 of 10 -> 1 … 4 5 6 … 10. Custom `item` markup replaces the buttons.
    const items = d.getByTestId('slot-item');
    await expect(items).toHaveCount(5, { timeout: 10_000 });
    await expect(items).toHaveText(['p1', 'p4', 'p5', 'p6', 'p10']);
    // `selected` is true for exactly the current page.
    await expect(d.locator('[data-testid="slot-item"][data-selected="yes"]')).toHaveText('p5');
    await expect(d.locator('[data-testid="slot-item"][data-selected="no"]')).toHaveCount(4);
    // `ellipsis` receives an index.
    await expect(d.getByTestId('slot-ellipsis')).toHaveCount(2);
    // prev/next controls receive `page` (the target) and `disabled`.
    await expect(d.getByTestId('slot-prev')).toHaveAttribute('data-target', '4');
    await expect(d.getByTestId('slot-next')).toHaveAttribute('data-target', '6');
    await expect(d.getByTestId('slot-prev')).toBeEnabled();

    // `goto` from the item slot navigates; from prev/next steps.
    await d.locator('[data-testid="slot-item"][data-page="6"]').click();
    await expect.poll(() => text(pageOut), { timeout: 10_000 }).toBe('6');
    await d.getByTestId('slot-prev').click();
    await expect.poll(() => text(pageOut), { timeout: 10_000 }).toBe('5');
    await d.getByTestId('slot-next').click();
    await expect.poll(() => text(pageOut), { timeout: 10_000 }).toBe('6');
    // The default buttons are replaced, not duplicated.
    await expect(d.getByRole('button', { name: 'Previous page' })).toHaveCount(0);
    await expect(d.getByRole('button', { name: 'Next page' })).toHaveCount(0);
  });

  runner(`pagination surface [${target}]: keyboard — Arrow/Home/End rove focus; activating a page keeps focus on it`, async ({
    page,
  }) => {
    await page.goto(`/?example=PaginationSurface&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const a = nav(page, 'Pager A');
    await expect(a).toBeVisible({ timeout: 15_000 });
    expect(await text(page.getByTestId('a-page'))).toBe('10');

    // The active page is the roving tab stop; the other pages are out of the tab order.
    const tabs = await a.locator('[data-page-control]').evaluateAll((els) =>
      els.map((e) => `${e.getAttribute('aria-label')}:${(e as HTMLElement).tabIndex}`),
    );
    expect(tabs).toContain('Go to page 10:0');
    expect(tabs).toContain('Go to page 9:-1');

    await a.getByRole('button', { name: 'Go to page 10' }).focus();
    await page.keyboard.press('ArrowRight');
    expect(await focusedLabel(page)).toBe('Go to page 11');
    await page.keyboard.press('ArrowLeft');
    expect(await focusedLabel(page)).toBe('Go to page 10');
    await page.keyboard.press('End');
    expect(await focusedLabel(page)).toBe('Next page');
    await page.keyboard.press('Home');
    expect(await focusedLabel(page)).toBe('Previous page');
    await page.keyboard.press('ArrowDown');
    expect(await focusedLabel(page)).toBe('Go to page 1');
    await page.keyboard.press('ArrowUp');
    expect(await focusedLabel(page)).toBe('Previous page');

    // Activating a page from the keyboard moves the window but must not drop focus.
    await a.getByRole('button', { name: 'Go to page 11' }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => text(page.getByTestId('a-page')), { timeout: 10_000 }).toBe('11');
    await page.waitForTimeout(250);
    expect(await focusedLabel(page)).toBe('Go to page 11');
    // ...and the roving arrows still work from there.
    await page.keyboard.press('ArrowRight');
    expect(await focusedLabel(page)).toBe('Go to page 12');
    await page.keyboard.press('Space');
    await expect.poll(() => text(page.getByTestId('a-page')), { timeout: 10_000 }).toBe('12');
    await page.waitForTimeout(250);
    expect(await focusedLabel(page)).toBe('Go to page 12');
  });
}
