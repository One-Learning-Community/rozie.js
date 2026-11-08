import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeDrag } from '../host/dragEvent';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * sortable-keyboard-keys — SortableList within-list keyboard keys on every
 * target cell: Home / End / PageUp / PageDown while lifted, Escape reverting a
 * single-list move, keyboard `start`/`change`/`end` events carrying
 * `interaction: 'keyboard'`, the list container's role, and the
 * spoken instructions referenced by `aria-describedby`.
 *
 * Fixture: SortableListKeysDemo (one vertical row-mode list, no `group`,
 * seeded Apple / Banana / Cherry / Date / Elderberry), plus
 * SortableListHandleDemo for the handle-mode instructions slot prop.
 *
 * Conventions mirror sortable-drag-keyboard.spec.ts: 6-target loop with the
 * dist-availability `test.fixme` fallback, substring locators (survive
 * CSS-Modules hashing, pierce Lit shadow DOM), STRUCTURAL assertions only.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

const ITEM = '[class*="rozie-sortable-item"]';
const LIST = '[class*="rozie-sortable-list"]';
const ARIA_LIVE = '[data-rozie-sortable-aria-live]';
const STATE_LI = '[class*="state-list"] li';
const LOG_LI = '[class*="event-log"] li';
const GRIP = '[class*="grip"]';
const LIFTED = '[class*="rozie-sortable-item-lifted"]';

const SEED = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];
const INSTRUCTIONS =
  'Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel.';

function displayedLabels(locator: ReturnType<Page['locator']>) {
  return locator.evaluateAll((els) =>
    els.map((el) => {
      const label = el.querySelector('[class*="label"]');
      return ((label ?? el).textContent ?? '').trim();
    }),
  );
}

function texts(locator: ReturnType<Page['locator']>) {
  return locator.evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
}

/** Text of the deepest active element (walks open shadow roots). */
function activeText(page: Page) {
  return page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a && (a as HTMLElement).shadowRoot && (a as HTMLElement).shadowRoot!.activeElement) {
      a = (a as HTMLElement).shadowRoot!.activeElement;
    }
    if (!a || a.tagName === 'BODY') return '<body>';
    return (a.textContent ?? '').trim();
  });
}

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  async function open(page: Page) {
    await page.goto(`/?example=SortableListKeys&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    const items = mount.locator(ITEM);
    await expect(items).toHaveCount(SEED.length);
    await expect(items.first()).toHaveAttribute('tabindex', '0');
    return { mount, items, aria: mount.locator(ARIA_LIVE) };
  }

  /**
   * Nothing disappeared: the rendered rows, the state sidecar and the seed hold
   * the same labels, with no row shown twice.
   */
  async function assertInvariant(mount: ReturnType<Page['getByTestId']>) {
    const seed = [...SEED].sort();
    await expect.poll(async () => (await displayedLabels(mount.locator(ITEM))).sort()).toEqual(seed);
    await expect.poll(async () => (await texts(mount.locator(STATE_LI))).sort()).toEqual(seed);
  }

  async function expectOrder(
    mount: ReturnType<Page['getByTestId']>,
    items: ReturnType<Page['locator']>,
    order: string[],
  ) {
    await expect.poll(() => displayedLabels(items)).toEqual(order);
    await expect.poll(() => texts(mount.locator(STATE_LI))).toEqual(order);
  }

  // An object `itemClass` and an array-with-object `listClass` land on the rows
  // and the list (Angular's native [class] dropped objects nested in a class
  // list; the falsy key must still be left off).
  runner(`sortable-keyboard-keys [${target}]: object itemClass / listClass apply`, async ({ page }) => {
    const { mount, items } = await open(page);
    const list = mount.locator(LIST).first();
    await expect(list).toHaveClass(/(^|\s)demo-list(\s|$)/);
    await expect(list).toHaveClass(/(^|\s)demo-list-flag(\s|$)/);
    for (let i = 0; i < SEED.length; i++) {
      await expect(items.nth(i)).toHaveClass(/(^|\s)demo-item-flag(\s|$)/);
      await expect(items.nth(i)).not.toHaveClass(/demo-item-off/);
    }
    // The lifted-row class still joins the row's other classes.
    await items.nth(1).focus();
    await page.keyboard.press('Space');
    await expect(items.nth(1)).toHaveClass(/rozie-sortable-item-lifted/);
    await expect(items.nth(1)).toHaveClass(/(^|\s)demo-item-flag(\s|$)/);
    await page.keyboard.press('Escape');
  });

  runner(`sortable-keyboard-keys [${target}]: End moves the lifted row last`, async ({ page }) => {
    const { mount, items, aria } = await open(page);
    await items.nth(0).focus();
    await page.keyboard.press('Space');
    await expect(aria).toHaveText('Lifted Apple');
    await page.keyboard.press('End');
    await expect(aria).toHaveText('Moved Apple to position 5');
    await page.keyboard.press('Space');
    await expect(aria).toHaveText('Dropped Apple at position 5');
    await expectOrder(mount, items, ['Banana', 'Cherry', 'Date', 'Elderberry', 'Apple']);
  });

  runner(`sortable-keyboard-keys [${target}]: Home moves the lifted row first`, async ({ page }) => {
    const { mount, items, aria } = await open(page);
    await items.nth(4).focus();
    await page.keyboard.press('Space');
    await expect(aria).toHaveText('Lifted Elderberry');
    await page.keyboard.press('Home');
    await expect(aria).toHaveText('Moved Elderberry to position 1');
    await page.keyboard.press('Space');
    await expectOrder(mount, items, ['Elderberry', 'Apple', 'Banana', 'Cherry', 'Date']);
  });

  runner(
    `sortable-keyboard-keys [${target}]: PageDown clamps at the end with fewer than pageStep rows left`,
    async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await items.nth(1).focus();
      await page.keyboard.press('Space');
      await expect(aria).toHaveText('Lifted Banana');
      await page.keyboard.press('PageDown');
      await expect(aria).toHaveText('Moved Banana to position 5');
      await page.keyboard.press('Space');
      await expectOrder(mount, items, ['Apple', 'Cherry', 'Date', 'Elderberry', 'Banana']);
      // And PageUp clamps at the start.
      await page.keyboard.press('Space');
      await page.keyboard.press('PageUp');
      await expect(aria).toHaveText('Moved Banana to position 1');
      await page.keyboard.press('Space');
      await expectOrder(mount, items, ['Banana', 'Apple', 'Cherry', 'Date', 'Elderberry']);
    },
  );

  runner(`sortable-keyboard-keys [${target}]: Escape reverts a single-list move`, async ({ page }) => {
    const { mount, items, aria } = await open(page);
    await items.nth(0).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await expect(aria).toHaveText('Moved Apple to position 2');
    await page.keyboard.press('ArrowDown');
    await expect(aria).toHaveText('Moved Apple to position 3');
    await page.keyboard.press('Escape');
    await expect(aria).toHaveText('Cancelled. Apple returned to position 1');
    await expectOrder(mount, items, SEED);
    await expect.poll(() => activeText(page), { timeout: 5000 }).toBe('Apple');
    // The lift is over: an arrow no longer moves anything.
    await page.keyboard.press('ArrowDown');
    await expectOrder(mount, items, SEED);
    await expect(mount.locator(LOG_LI).last()).toHaveText('end:keyboard');
  });

  runner(
    `sortable-keyboard-keys [${target}]: keyboard emits start and end with interaction keyboard`,
    async ({ page }) => {
      const { mount, items } = await open(page);
      await items.nth(0).focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['start:keyboard', 'change:keyboard', 'end:keyboard']);
    },
  );

  runner(
    `sortable-keyboard-keys [${target}]: list container has role list and no aria-orientation`,
    async ({ page }) => {
      const { mount } = await open(page);
      const list = mount.locator(LIST).first();
      await expect(list).toHaveAttribute('role', 'list');
      // aria-orientation is not an allowed attribute on role="list".
      await expect(list).not.toHaveAttribute('aria-orientation', /.*/);
    },
  );

  runner(
    `sortable-keyboard-keys [${target}]: rows are described by the default instructions`,
    async ({ page }) => {
      const { items } = await open(page);
      await expect(items.first()).toHaveAccessibleDescription(INSTRUCTIONS);
    },
  );

  runner(
    `sortable-keyboard-keys [${target}]: the handle demo's buttons are described via the instructionsId slot prop`,
    async ({ page }) => {
      await page.goto(`/?example=SortableListHandle&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      const section = mount.getByTestId('handle-list');
      await expect(section.locator(ITEM)).toHaveCount(4);
      await expect(section.locator(GRIP).first()).toHaveAccessibleDescription(
        /^Press Space or Enter to pick up\./,
      );
    },
  );

  // No-wait bursts whose result depends on End / PageDown actually moving.
  runner(
    `sortable-keyboard-keys [${target}]: back-to-back Space, End, ArrowUp, Space (no waits)`,
    async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await items.nth(0).focus();
      for (const key of ['Space', 'End', 'ArrowUp', 'Space']) await page.keyboard.press(key);
      await expect(aria).toHaveText('Dropped Apple at position 4');
      await expectOrder(mount, items, ['Banana', 'Cherry', 'Date', 'Apple', 'Elderberry']);
      await expect.poll(() => activeText(page), { timeout: 5000 }).toBe('Apple');
      await assertInvariant(mount);
    },
  );

  runner(
    `sortable-keyboard-keys [${target}]: back-to-back Space, PageDown, Home, PageDown, Space (no waits)`,
    async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await items.nth(0).focus();
      // 5 rows, pageStep 5: PageDown clamps 0 → 4, Home → 0, PageDown → 4.
      for (const key of ['Space', 'PageDown', 'Home', 'PageDown', 'Space']) await page.keyboard.press(key);
      await expect(aria).toHaveText('Dropped Apple at position 5');
      await expectOrder(mount, items, ['Banana', 'Cherry', 'Date', 'Elderberry', 'Apple']);
      await expect.poll(() => activeText(page), { timeout: 5000 }).toBe('Apple');
      await assertInvariant(mount);
    },
  );

  runner(
    `sortable-keyboard-keys [${target}]: Escape with nothing lifted does nothing`,
    async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await items.nth(1).focus();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      // Give any (wrong) async write a chance to land before asserting.
      await page.waitForTimeout(100);
      await expectOrder(mount, items, SEED);
      await expect(mount.locator(LOG_LI)).toHaveCount(0);
      await expect(aria).toHaveText('');
    },
  );

  runner(
    `sortable-keyboard-keys [${target}]: a pointer drag ends an active keyboard lift`,
    async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await items.nth(0).focus();
      await page.keyboard.press('Space');
      await expect(aria).toHaveText('Lifted Apple');
      await expect(mount.locator(LIFTED)).toHaveCount(1);
      // Drag Banana below Date with the pointer.
      await synthesizeDrag(page, {
        sourceHandle: items.nth(1).locator('[class*="label"]'),
        target: items.nth(3),
      });
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect
        .poll(async () => (await texts(mount.locator(LOG_LI))).slice(0, 3))
        .toEqual(['start:keyboard', 'end:keyboard', 'start:pointer']);
      await expect.poll(() => texts(mount.locator(LOG_LI))).toContain('end:pointer');
    },
  );

  // A real user does not wait between presses.
  runner(
    `sortable-keyboard-keys [${target}]: back-to-back Space, End, Home, ArrowDown, Space (no waits)`,
    async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await items.nth(0).focus();
      for (const key of ['Space', 'End', 'Home', 'ArrowDown', 'Space']) await page.keyboard.press(key);
      await expect(aria).toHaveText('Dropped Apple at position 2');
      await expectOrder(mount, items, ['Banana', 'Apple', 'Cherry', 'Date', 'Elderberry']);
      await expect.poll(() => activeText(page), { timeout: 5000 }).toBe('Apple');
      await assertInvariant(mount);
    },
  );
}
