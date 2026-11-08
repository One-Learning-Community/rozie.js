import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * sortable-keyboard-handle — SortableList `keyboardTrigger="handle"` contract
 * (quick 261107-s4a), on every target cell.
 *
 * In handle mode rows are NOT tab stops; only keys pressed inside the
 * consumer's handle <button> (matched by the `handle` selector) drive the
 * Space/Enter lift-drop, Arrow move and Escape cancel flow, and focus returns
 * to the MOVED row's handle after every move.
 *
 * Fixture: SortableListHandleDemo (4 rows: Hero banner / Pricing / Testimonials
 * / Footer; each row = a `.grip` <button aria-label="Reorder X"> + label span +
 * a plain text <input>).
 *
 * Conventions mirror sortable-drag-keyboard.spec.ts: 6-target loop with the
 * dist-availability `test.fixme` fallback, empty KNOWN_FAILING, substring
 * locators (survive CSS-Modules hashing, pierce Lit shadow DOM), STRUCTURAL
 * assertions only (no screenshot matchers), `expect.poll` for focus reads
 * (Angular CD settles async).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

const ITEM = '[class*="rozie-sortable-item"]';
const LIFTED = '[class*="rozie-sortable-item-lifted"]';
const ARIA_LIVE = '[data-rozie-sortable-aria-live]';
const STATE_LI = '[class*="state-list"] li';
const GRIP = '[class*="grip"]';

const HERO = 'Hero banner';
const PRICING = 'Pricing';
const TESTIMONIALS = 'Testimonials';
const FOOTER = 'Footer';

/** Deepest active element (walks open shadow roots) → tag / aria-label / testid. */
function deepestActive(page: Page) {
  return page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (
      a &&
      (a as HTMLElement).shadowRoot &&
      (a as HTMLElement).shadowRoot!.activeElement
    ) {
      a = (a as HTMLElement).shadowRoot!.activeElement;
    }
    if (!a) return { tag: '', ariaLabel: null as string | null, testid: null as string | null };
    return {
      tag: a.tagName,
      ariaLabel: a.getAttribute('aria-label'),
      testid: a.getAttribute('data-testid'),
    };
  });
}

function displayedLabels(locator: ReturnType<Page['locator']>) {
  return locator.evaluateAll((els) =>
    els.map((el) => {
      const label = el.querySelector('[class*="label"]');
      return ((label ?? el).textContent ?? '').trim();
    }),
  );
}

function stateLabels(locator: ReturnType<Page['locator']>) {
  return locator.evaluateAll((els) =>
    els.map((li) => {
      const label = li.querySelector('span:last-child');
      return ((label ?? li).textContent ?? '').trim();
    }),
  );
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  runner(
    `sortable-keyboard-handle [${target}]: lift/move/drop via the handle, focus follows the moved row's handle`,
    async ({ page }) => {
      await page.goto(`/?example=SortableListHandle&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();
      const section = mount.getByTestId('handle-list');
      const items = section.locator(ITEM);
      await expect(items).toHaveCount(4);
      const aria = section.locator(ARIA_LIVE);

      // Rows are not tab stops in handle mode.
      for (let i = 0; i < 4; i++) {
        await expect(items.nth(i)).not.toHaveAttribute('tabindex', /.*/);
        expect(await items.nth(i).evaluate((el) => (el as HTMLElement).tabIndex)).toBe(-1);
      }

      expect(await displayedLabels(items)).toEqual([HERO, PRICING, TESTIMONIALS, FOOTER]);

      // Focus row 0's handle button and LIFT.
      await items.first().locator(GRIP).focus();
      await expect
        .poll(async () => (await deepestActive(page)).ariaLabel, { timeout: 2000 })
        .toBe(`Reorder ${HERO}`);
      await page.keyboard.press('Space');
      await expect(aria).toHaveText(`Lifted ${HERO}`);

      // MOVE twice; focus must follow the moved row's handle each time.
      await page.keyboard.press('ArrowDown');
      await expect(aria).toHaveText(`Moved ${HERO} to position 2`);
      await expect
        .poll(async () => (await deepestActive(page)).ariaLabel, { timeout: 5000 })
        .toBe(`Reorder ${HERO}`);
      await page.keyboard.press('ArrowDown');
      await expect(aria).toHaveText(`Moved ${HERO} to position 3`);
      await expect
        .poll(async () => (await deepestActive(page)).ariaLabel, { timeout: 5000 })
        .toBe(`Reorder ${HERO}`);

      // Enter DROPS.
      await page.keyboard.press('Enter');
      await expect(aria).toHaveText(`Dropped ${HERO} at position 3`);

      const expected = [PRICING, TESTIMONIALS, HERO, FOOTER];
      await expect.poll(() => displayedLabels(items)).toEqual(expected);
      expect(await stateLabels(section.locator(STATE_LI))).toEqual(expected);
      await expect
        .poll(async () => (await deepestActive(page)).ariaLabel, { timeout: 5000 })
        .toBe(`Reorder ${HERO}`);
      // Handled keys preventDefault → the handle button's click never fires.
      await expect(section.getByTestId('handle-clicks')).toHaveText('0');

      // Lift again, then Escape cancels.
      await page.keyboard.press('Space');
      await expect(aria).toHaveText(`Lifted ${HERO}`);
      await page.keyboard.press('Escape');
      await expect(aria).toHaveText(`Cancelled lift of ${HERO}`);
    },
  );
}
