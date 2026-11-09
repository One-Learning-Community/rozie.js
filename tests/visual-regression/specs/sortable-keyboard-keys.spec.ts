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
 * single-list move, keyboard `start`/`reorder`/`end` events carrying
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
        .toEqual(['start:keyboard', 'reorder:keyboard', 'end:keyboard']);
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

  // The list has a `#header` and a `#footer` (on Lit both render `<slot>`
  // children of the list element). Every payload's indices count item rows
  // only, and pointer and keyboard payloads have the same shape.
  const lastEnd = async (mount: ReturnType<Page['getByTestId']>) =>
    JSON.parse((await mount.getByTestId('last-end').textContent()) || 'null');

  runner(`sortable-keyboard-keys [${target}]: indices ignore header and footer`, async ({ page }) => {
    const { mount, items } = await open(page);
    await expect(mount.locator('[class*="list-header"]')).toHaveText('Fruit (5)');
    await expect(mount.locator('[class*="list-footer"]')).toHaveText('End of list');
    await synthesizeDrag(page, {
      sourceHandle: items.nth(0).locator('[class*="label"]'),
      target: items.nth(2),
    });
    await expectOrder(mount, items, ['Banana', 'Cherry', 'Apple', 'Date', 'Elderberry']);
    await expect
      .poll(() => texts(mount.locator(LOG_LI)))
      .toEqual(['start:pointer', 'reorder:pointer', 'end:pointer']);
    await expect.poll(() => lastEnd(mount)).toEqual({
      item: 'Apple',
      el: 'element',
      from: 'Fruit',
      to: 'Fruit',
      oldIndex: 0,
      newIndex: 2,
      interaction: 'pointer',
    });
    await assertInvariant(mount);
  });

  runner(`sortable-keyboard-keys [${target}]: pointer drop in place writes nothing`, async ({ page }) => {
    const { mount, items } = await open(page);
    // Released on its own row: `start` / `end` only, same index.
    await synthesizeDrag(page, {
      sourceHandle: items.nth(1).locator('[class*="label"]'),
      target: items.nth(1),
    });
    await expect.poll(() => texts(mount.locator(LOG_LI))).toEqual(['start:pointer', 'end:pointer']);
    await expect.poll(() => lastEnd(mount)).toMatchObject({ item: 'Banana', oldIndex: 1, newIndex: 1 });
    await expectOrder(mount, items, SEED);
  });

  runner(`sortable-keyboard-keys [${target}]: keyboard end payload matches pointer`, async ({ page }) => {
    const { mount, items, aria } = await open(page);
    await items.nth(0).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await expect(aria).toHaveText('Moved Apple to position 2');
    await page.keyboard.press('ArrowDown');
    await expect(aria).toHaveText('Moved Apple to position 3');
    await page.keyboard.press('Space');
    await expect(aria).toHaveText('Dropped Apple at position 3');
    await expect.poll(() => lastEnd(mount)).toEqual({
      item: 'Apple',
      el: 'element',
      from: 'Fruit',
      to: 'Fruit',
      oldIndex: 0,
      newIndex: 2,
      interaction: 'keyboard',
    });
    await assertInvariant(mount);
  });

  // A real user does not wait between presses.
  runner(
    `sortable-keyboard-keys [${target}]: keyboard end payload, back-to-back (no waits)`,
    async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await items.nth(0).focus();
      for (const key of ['Space', 'ArrowDown', 'ArrowDown', 'Space']) await page.keyboard.press(key);
      await expect(aria).toHaveText('Dropped Apple at position 3');
      await expectOrder(mount, items, ['Banana', 'Cherry', 'Apple', 'Date', 'Elderberry']);
      await expect.poll(() => lastEnd(mount)).toEqual({
        item: 'Apple',
        el: 'element',
        from: 'Fruit',
        to: 'Fruit',
        oldIndex: 0,
        newIndex: 2,
        interaction: 'keyboard',
      });
      await assertInvariant(mount);
    },
  );

  // The `end` handler reads the bound array AFTER Escape wrote the restored
  // order (React's handler closure included: `end` runs after the re-render).
  runner(`sortable-keyboard-keys [${target}]: end handler sees the order Escape restored`, async ({ page }) => {
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
    await expect(mount.getByTestId('end-order')).toHaveText('a,b,c,d,e');
    await expect.poll(() => texts(mount.locator(LOG_LI))).toEqual([
      'start:keyboard',
      'reorder:keyboard',
      'reorder:keyboard',
      'reorder:keyboard',
      'end:keyboard',
    ]);
    await assertInvariant(mount);
  });

  runner(
    `sortable-keyboard-keys [${target}]: end handler sees the order Escape restored, back-to-back (no waits)`,
    async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await items.nth(0).focus();
      for (const key of ['Space', 'ArrowDown', 'ArrowDown', 'Escape']) await page.keyboard.press(key);
      await expect(aria).toHaveText('Cancelled. Apple returned to position 1');
      await expectOrder(mount, items, SEED);
      await expect(mount.getByTestId('end-order')).toHaveText('a,b,c,d,e');
      await assertInvariant(mount);
    },
  );

  /** Programmatic click: keeps focus where it is (a real click would move it). */
  async function clickKeepingFocus(mount: ReturnType<Page['getByTestId']>, testId: string) {
    await mount.getByTestId(testId).evaluate((b) => (b as HTMLElement).click());
  }

  /** The label of every highlighted (lifted) row. */
  function liftedLabels(mount: ReturnType<Page['getByTestId']>) {
    return displayedLabels(mount.locator(LIFTED));
  }

  /** Every label exactly once, in the rendered rows and in the state sidecar. */
  async function assertEachOnce(mount: ReturnType<Page['getByTestId']>, labels: string[]) {
    const want = [...labels].sort();
    await expect.poll(async () => (await displayedLabels(mount.locator(ITEM))).sort()).toEqual(want);
    await expect.poll(async () => (await texts(mount.locator(STATE_LI))).sort()).toEqual(want);
  }

  for (const burst of [false, true]) {
    const tag = burst ? ', back-to-back (no waits)' : '';

    // Turning the keyboard off mid-lift ends the lift where the row is, with
    // `end` (once), whether through the prop or the imperative option().
    for (const how of ['option', 'prop', 'options'] as const) {
      const label = how === 'option' ? "option('disabled')" : how === 'prop' ? 'disabled prop' : 'options.disabled';
      runner(`sortable-keyboard-keys [${target}]: ${label} mid-lift ends the lift${tag}`, async ({ page }) => {
        const { mount, items, aria } = await open(page);
        await items.nth(1).focus();
        if (burst) {
          for (const key of ['Space', 'ArrowDown']) await page.keyboard.press(key);
        } else {
          await page.keyboard.press('Space');
          await expect(aria).toHaveText('Lifted Banana');
          await page.keyboard.press('ArrowDown');
          await expect(aria).toHaveText('Moved Banana to position 3');
        }
        await clickKeepingFocus(
          mount,
          how === 'option' ? 'disable-option' : how === 'prop' ? 'disable-prop' : 'options-disabled',
        );
        // (A prop reaches Angular a task late: a key pressed before it lands
        // still acts on the lift. Wait for the change, then press Escape.)
        await expect(aria).toHaveText('Lift ended');
        // The row left the tab order: focus moved to the list, not <body>.
        await page.waitForTimeout(150);
        expect(await activeText(page)).not.toBe('<body>');
        // Escape after it does nothing (the lift is over, the keyboard is off).
        await page.keyboard.press('Escape');
        await expect(aria).toHaveText('Lift ended');
        await expect(mount.locator(LIFTED)).toHaveCount(0);
        await expectOrder(mount, items, ['Apple', 'Cherry', 'Banana', 'Date', 'Elderberry']);
        await expect
          .poll(() => texts(mount.locator(LOG_LI)))
          .toEqual(['start:keyboard', 'reorder:keyboard', 'end:keyboard']);
        await expect.poll(() => lastEnd(mount)).toEqual({
          item: 'Banana',
          el: 'element',
          from: 'Fruit',
          to: 'Fruit',
          oldIndex: 1,
          newIndex: 2,
          interaction: 'keyboard',
        });
        await page.waitForTimeout(150);
        expect((await texts(mount.locator(LOG_LI))).filter((e) => e.startsWith('end:'))).toEqual(['end:keyboard']);
        await assertInvariant(mount);
      });
    }


    // The keyboard turned off with a row focused and nothing lifted: the row
    // leaves the tab order, and focus moves to the list rather than <body>.
    for (const how of ['disable-prop', 'disable-keyboard'] as const) {
      runner(
        `sortable-keyboard-keys [${target}]: ${how === 'disable-prop' ? 'disabled' : 'disableKeyboard'} with a row focused keeps focus off <body>${tag}`,
        async ({ page }) => {
          const { mount, items } = await open(page);
          await items.nth(2).focus();
          if (burst) {
            await clickKeepingFocus(mount, how);
          } else {
            await expect.poll(() => activeText(page)).toBe('Cherry');
            await clickKeepingFocus(mount, how);
            await expect(items.nth(2)).not.toHaveAttribute('tabindex', /.*/);
          }
          await page.waitForTimeout(150);
          await expect(items.first()).not.toHaveAttribute('tabindex', /.*/);
          expect(await activeText(page)).not.toBe('<body>');
          await page.keyboard.press('Space');
          await page.waitForTimeout(100);
          await expect(mount.locator(LOG_LI)).toHaveCount(0);
          await expectOrder(mount, items, SEED);
        },
      );
    }

    // option('sort', false) at runtime: no in-list moves by keyboard.
    runner(`sortable-keyboard-keys [${target}]: option('sort', false) stops in-list moves${tag}`, async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await clickKeepingFocus(mount, 'sort-off');
      await items.nth(1).focus();
      if (burst) {
        for (const key of ['Space', 'ArrowDown', 'End', 'Home', 'PageDown', 'Space']) await page.keyboard.press(key);
      } else {
        await page.keyboard.press('Space');
        await expect(aria).toHaveText('Lifted Banana');
        for (const key of ['ArrowDown', 'End', 'Home', 'PageDown']) await page.keyboard.press(key);
        await page.waitForTimeout(100);
        await expect(aria).toHaveText('Lifted Banana');
        await page.keyboard.press('Space');
      }
      await expect(aria).toHaveText('Dropped Banana at position 2');
      await expectOrder(mount, items, SEED);
      await expect.poll(() => texts(mount.locator(LOG_LI))).toEqual(['start:keyboard', 'end:keyboard']);
      await assertInvariant(mount);
    });

    // options.draggable: only matching rows lift by keyboard.
    runner(`sortable-keyboard-keys [${target}]: a row not matching options.draggable cannot be lifted${tag}`, async ({ page }) => {
      const { mount, items, aria } = await open(page);
      await clickKeepingFocus(mount, 'draggable-ac');
      await expect(items).toHaveCount(SEED.length);
      await expect(items.nth(1)).toHaveAttribute('tabindex', '0');
      await items.nth(1).focus();
      if (burst) {
        for (const key of ['Space', 'ArrowDown', 'Space']) await page.keyboard.press(key);
      } else {
        await page.keyboard.press('Space');
        await page.waitForTimeout(100);
        await expect(mount.locator(LIFTED)).toHaveCount(0);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Space');
      }
      await page.waitForTimeout(150);
      await expect(aria).toHaveText('');
      await expect(mount.locator(LOG_LI)).toHaveCount(0);
      await expectOrder(mount, items, SEED);
      // Cherry matches: it lifts and moves.
      await items.nth(2).focus();
      await page.keyboard.press('Space');
      await expect(aria).toHaveText('Lifted Cherry');
      await page.keyboard.press('ArrowUp');
      await expect(aria).toHaveText('Moved Cherry to position 2');
      await page.keyboard.press('Space');
      await expectOrder(mount, items, ['Apple', 'Cherry', 'Banana', 'Date', 'Elderberry']);
      await assertInvariant(mount);
    });

    runner(
      `sortable-keyboard-keys [${target}]: lifted highlight follows the item after a consumer insert${tag}`,
      async ({ page }) => {
        const { mount, items, aria } = await open(page);
        await items.nth(1).focus();
        await page.keyboard.press('Space');
        if (!burst) await expect(aria).toHaveText('Lifted Banana');
        await clickKeepingFocus(mount, 'prepend');
        await expect(items).toHaveCount(SEED.length + 1);
        await expect.poll(() => liftedLabels(mount)).toEqual(['Banana']);
        if (burst) {
          for (const key of ['ArrowDown', 'ArrowDown', 'Space']) await page.keyboard.press(key);
          await expect(aria).toHaveText('Dropped Banana at position 5');
          await expectOrder(mount, items, ['Zucchini', 'Apple', 'Cherry', 'Date', 'Banana', 'Elderberry']);
        } else {
          await page.keyboard.press('ArrowDown');
          await expect(aria).toHaveText('Moved Banana to position 4');
          await expectOrder(mount, items, ['Zucchini', 'Apple', 'Cherry', 'Banana', 'Date', 'Elderberry']);
          await expect.poll(() => liftedLabels(mount)).toEqual(['Banana']);
          await page.keyboard.press('Space');
          await expect(aria).toHaveText('Dropped Banana at position 4');
        }
        await expect(mount.locator(LIFTED)).toHaveCount(0);
        await assertEachOnce(mount, [...SEED, 'Zucchini']);
      },
    );

    // A row matching `filter` (a locked row) can't be lifted by keyboard, as
    // by mouse: Space / Enter on it does nothing and is not prevented.
    runner(
      `sortable-keyboard-keys [${target}]: a filtered (locked) row cannot be lifted by keyboard${tag}`,
      async ({ page }) => {
        await page.goto(`/?example=SortableListFilter&target=${target}`);
        const mount = page.getByTestId('rozie-mount');
        const rows = mount.locator(ITEM);
        const seed = ['Inbox', 'Drafts', 'Sent', 'Archive', 'Trash'];
        await expect(rows).toHaveCount(seed.length);
        await expect.poll(() => displayedLabels(rows)).toEqual(seed);
        // Record whether each keydown reached the document prevented.
        await page.evaluate(() => {
          (window as any).__prevented = [];
          document.addEventListener('keydown', (e) => (window as any).__prevented.push(e.defaultPrevented));
        });
        await rows.nth(0).focus();
        if (burst) {
          for (const key of ['Space', 'ArrowDown', 'ArrowDown', 'Space']) await page.keyboard.press(key);
        } else {
          await page.keyboard.press('Space');
          await page.waitForTimeout(100);
          await expect(mount.locator(LIFTED)).toHaveCount(0);
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Space');
        }
        await page.waitForTimeout(150);
        await expect.poll(() => displayedLabels(rows)).toEqual(seed);
        await expect(mount.locator(ARIA_LIVE)).toHaveText('');
        await expect(mount.locator(LIFTED)).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).__prevented)).toEqual([false, false, false, false]);
        // An unlocked row still lifts.
        await rows.nth(1).focus();
        await page.keyboard.press('Space');
        await expect(mount.locator(ARIA_LIVE)).toHaveText('Lifted Drafts');
        await page.keyboard.press('Escape');
        await expect(mount.locator(ARIA_LIVE)).toHaveText('Cancelled. Drafts returned to position 2');
        await expect.poll(() => displayedLabels(rows)).toEqual(seed);
      },
    );
  }
}
