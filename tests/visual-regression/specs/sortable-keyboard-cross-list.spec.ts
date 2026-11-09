import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * sortable-keyboard-cross-list — Shift+Arrow moves a lifted SortableList row
 * into the previous / next list of the same group, on every target cell.
 *
 * Fixture: SortableListZonesDemo — Palette (clone), Top sidebar, Content (with
 * a Grid row holding Grid column 1 / Grid column 2), Bottom sidebar, Archive
 * (put: false) and a list inside a `hidden` div, all in `group: 'zones'`,
 * handle mode by default. Each list has a `state-{slug}` sidecar; events land
 * in `.event-log` as `{slug}:{event}:{interaction}`.
 *
 * The anti-goal is "nothing disappears": every step asserts that the labels
 * across all lists are exactly the seed (plus any clone copies / added
 * widgets the test made), with no duplicates inside a non-palette list.
 *
 * Conventions mirror sortable-keyboard-keys.spec.ts: 6-target loop with the
 * dist-availability `test.fixme` fallback, shadow-piercing locators,
 * STRUCTURAL assertions only, back-to-back presses with no waits.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

const ITEM = '[class*="rozie-sortable-item"]';
const ARIA_LIVE = '[data-rozie-sortable-aria-live]';
const LOG_LI = '[class*="event-log"] li';
const LIFTED = '[class*="rozie-sortable-item-lifted"]';

const SLUGS = [
  'locked',
  'palette',
  'top',
  'content',
  'grid1',
  'grid2',
  'bottom',
  'archive',
  'hidden',
  'toola',
  'toolb',
] as const;
type Slug = (typeof SLUGS)[number];

const SEED: Record<Slug, string[]> = {
  locked: ['Pinned notice'],
  palette: ['Text block', 'Image'],
  top: ['Search', 'Newsletter', 'Tag cloud'],
  content: ['Hero banner', 'Intro text', 'Grid', 'Gallery'],
  grid1: ['Left card'],
  grid2: ['Right card'],
  bottom: ['Recent posts', 'Contact'],
  archive: ['Old promo'],
  hidden: ['Hidden widget'],
  toola: ['Bold', 'Italic', 'Underline'],
  toolb: ['Link', 'Quote'],
};
const SEED_LABELS = Object.values(SEED).flat();

const TOP_INSTRUCTIONS =
  'Press Space to pick up this widget. Shift with an arrow key moves it to another zone.';
const GROUP_INSTRUCTIONS =
  'Press Space or Enter to pick up, and again to drop. Use the up and down arrow keys to move, Home and End to jump to the start or end, Page Up and Page Down to move several places, and Escape to cancel. Hold Shift with an arrow key to move to another list.';
const HORIZONTAL_GROUP_INSTRUCTIONS =
  'Press Space or Enter to pick up, and again to drop. Use the left and right arrow keys to move, Home and End to jump to the start or end, Page Up and Page Down to move several places, and Escape to cancel. Hold Shift with an arrow key to move to another list.';

type Mount = ReturnType<Page['getByTestId']>;

function texts(locator: ReturnType<Page['locator']>) {
  return locator.evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
}

function state(mount: Mount, slug: Slug) {
  return texts(mount.locator(`[class*="state-${slug}"] li`));
}

async function allStates(mount: Mount): Promise<Record<Slug, string[]>> {
  const out = {} as Record<Slug, string[]>;
  for (const slug of SLUGS) out[slug] = await state(mount, slug);
  return out;
}

/**
 * Nothing disappeared: the multiset of all labels equals the seed plus
 * `extra` (clone copies / added widgets), and no non-palette list holds a
 * label twice.
 */
async function assertNothingDisappeared(mount: Mount, extra: string[] = []) {
  const expected = [...SEED_LABELS, ...extra].sort();
  await expect
    .poll(async () => Object.values(await allStates(mount)).flat().sort())
    .toEqual(expected);
  const now = await allStates(mount);
  for (const slug of SLUGS) {
    if (slug === 'palette') continue;
    expect(new Set(now[slug]).size, `duplicates in ${slug}: ${now[slug].join(', ')}`).toBe(
      now[slug].length,
    );
  }
  // The rendered rows agree with the state: every mounted list renders once,
  // with the same multiset of labels as its state, and no rendered list
  // (other than the palette) shows a row twice. (An unmounted list renders
  // nothing; its state is still covered above.)
  await expect
    .poll(async () => {
      const st = await allStates(mount);
      const lists = await renderedLists(mount);
      const problems: string[] = [];
      const seen = new Set<string>();
      for (const l of lists) {
        if (seen.has(l.name)) problems.push(`${l.name} rendered twice`);
        seen.add(l.name);
        const slug = SLUG_OF[l.name];
        if (!slug) {
          problems.push(`unknown list ${l.name}`);
          continue;
        }
        const rows = [...l.rows].sort();
        const want = [...st[slug]].sort();
        if (JSON.stringify(rows) !== JSON.stringify(want)) {
          problems.push(`${l.name} renders [${rows.join(', ')}] but holds [${want.join(', ')}]`);
        }
      }
      return problems;
    })
    .toEqual([]);
  for (const list of await renderedLists(mount)) {
    if (list.name === 'Palette') continue;
    expect(new Set(list.rows).size, `rendered duplicates in ${list.name}: ${list.rows.join(', ')}`).toBe(
      list.rows.length,
    );
  }
}

/** listLabel → state slug. */
const SLUG_OF: Record<string, Slug> = {
  Locked: 'locked',
  Palette: 'palette',
  'Top sidebar': 'top',
  Content: 'content',
  'Grid column 1': 'grid1',
  'Grid column 2': 'grid2',
  'Bottom sidebar': 'bottom',
  Archive: 'archive',
  'Hidden zone': 'hidden',
  'Toolbar A': 'toola',
  'Toolbar B': 'toolb',
};

/** Every rendered list (pierces shadow roots) with the labels of its own rows. */
function renderedLists(mount: Mount) {
  return mount.locator('[role="list"]').evaluateAll((lists) =>
    lists.map((list) => ({
      name: list.getAttribute('aria-label') ?? '',
      rows: Array.from(list.children)
        .filter((row) => (row.getAttribute('class') ?? '').includes('rozie-sortable-item'))
        .map((row) => ((row.querySelector('[class*="label"]') ?? row).textContent ?? '').trim()),
    })),
  );
}

/** Non-empty aria-live texts across every list (pierces shadow roots). */
function liveTexts(mount: Mount) {
  return mount
    .locator(ARIA_LIVE)
    .evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()).filter((t) => t !== ''));
}

/** The deepest active element (walks open shadow roots). */
function active(page: Page) {
  return page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a && (a as HTMLElement).shadowRoot && (a as HTMLElement).shadowRoot!.activeElement) {
      a = (a as HTMLElement).shadowRoot!.activeElement;
    }
    if (!a || a.tagName === 'BODY') return '<body>';
    if (a.classList.contains('rozie-sortable-item')) {
      const label = a.querySelector('[class*="label"]');
      return 'row:' + ((label ?? a).textContent ?? '').trim();
    }
    return a.getAttribute('aria-label') ?? (a.textContent ?? '').trim();
  });
}

function grip(mount: Mount, label: string) {
  return mount.getByRole('button', { name: 'Reorder ' + label, exact: true });
}

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  async function open(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`/?example=SortableListZones&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect.poll(() => state(mount, 'content')).toEqual(SEED.content);
    await expect(grip(mount, 'Tag cloud')).toBeVisible();
    await assertNothingDisappeared(mount);
    return { mount, errors };
  }

  /** Programmatic click: keeps focus where it is (a real click would move it). */
  async function clickKeepingFocus(mount: Mount, testId: string) {
    await mount.getByTestId(testId).evaluate((b) => (b as HTMLElement).click());
  }

  runner(
    `sortable-keyboard-cross-list [${target}]: Shift+↓ hops forward to the top of the next zone`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Tag cloud').focus();
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Tag cloud, position 3 of 3']);
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'content')).toEqual(['Tag cloud', ...SEED.content]);
      await expect.poll(() => state(mount, 'top')).toEqual(['Search', 'Newsletter']);
      await expect.poll(() => liveTexts(mount)).toEqual(['Moved Tag cloud to Content, position 1 of 5']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Tag cloud');
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['top:start:keyboard', 'content:add:keyboard', 'top:remove:keyboard']);
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Tag cloud in Content at position 1 of 5']);
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect.poll(async () => (await texts(mount.locator(LOG_LI))).at(-1)).toBe('content:end:keyboard');
      // Keyboard `end` carries the same payload as pointer: the item value
      // and its row element.
      await expect
        .poll(async () => JSON.parse((await mount.getByTestId('last-end').textContent()) || 'null'))
        .toEqual({ item: 'Tag cloud', el: 'element', interaction: 'keyboard' });
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Tag cloud');
      await assertNothingDisappeared(mount);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: Shift+↑ hops back to the bottom of the previous zone`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Hero banner').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowUp');
      await expect
        .poll(() => state(mount, 'top'))
        .toEqual([...SEED.top, 'Hero banner']);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Moved Hero banner to Top sidebar, position 4 of 4']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Hero banner');
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Hero banner in Top sidebar at position 4 of 4']);
      await assertNothingDisappeared(mount);
    },
  );

  // Source order with no special nesting: Content → Grid column 1 → Grid
  // column 2 → Bottom sidebar (design spec, "What next list means").
  runner(
    `sortable-keyboard-cross-list [${target}]: hops pass through grid columns in source order`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Intro text').focus();
      await page.keyboard.press('Space');

      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'grid1')).toEqual(['Intro text', 'Left card']);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Moved Intro text to Grid column 1, position 1 of 2']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Intro text');
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'grid2')).toEqual(['Intro text', 'Right card']);
      await expect.poll(() => state(mount, 'grid1')).toEqual(['Left card']);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Moved Intro text to Grid column 2, position 1 of 2']);
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'bottom')).toEqual(['Intro text', ...SEED.bottom]);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Moved Intro text to Bottom sidebar, position 1 of 3']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Intro text');
      await assertNothingDisappeared(mount);

      // And back up again: Bottom sidebar → Grid column 2 (lands last).
      await page.keyboard.press('Shift+ArrowUp');
      await expect.poll(() => state(mount, 'grid2')).toEqual(['Right card', 'Intro text']);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Moved Intro text to Grid column 2, position 2 of 2']);
      await assertNothingDisappeared(mount);
      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Intro text in Grid column 2 at position 2 of 2']);
      await assertNothingDisappeared(mount);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: the Grid row cannot hop into its own columns`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Grid').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'bottom')).toEqual(['Grid', ...SEED.bottom]);
      await expect
        .poll(() => state(mount, 'content'))
        .toEqual(['Hero banner', 'Intro text', 'Gallery']);
      await expect.poll(() => liveTexts(mount)).toEqual(['Moved Grid to Bottom sidebar, position 1 of 3']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Grid');
      // The columns travelled with the Grid row.
      await expect(grip(mount, 'Left card')).toBeVisible();
      await assertNothingDisappeared(mount);
      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Grid in Bottom sidebar at position 1 of 3']);
      await assertNothingDisappeared(mount);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: put:false and hidden lists are skipped`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Contact').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => liveTexts(mount)).toEqual(['No list after Bottom sidebar']);
      await expect.poll(() => state(mount, 'bottom')).toEqual(SEED.bottom);
      await expect.poll(() => state(mount, 'archive')).toEqual(SEED.archive);
      await expect.poll(() => state(mount, 'hidden')).toEqual(SEED.hidden);
      await expect(mount.locator(LIFTED)).toHaveCount(1);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Contact');
      await assertNothingDisappeared(mount);
      await page.keyboard.press('Escape');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Cancelled. Contact returned to position 2 of 2']);
      await assertNothingDisappeared(mount);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: clone palette deposits one copy`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Text block').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'top')).toEqual(['Text block', ...SEED.top]);
      await expect.poll(() => state(mount, 'palette')).toEqual(SEED.palette);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Moved Text block to Top sidebar, position 1 of 4']);
      await assertNothingDisappeared(mount, ['Text block']);
      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Text block in Top sidebar at position 1 of 4']);
      await expect.poll(() => state(mount, 'palette')).toEqual(SEED.palette);
      await expect.poll(() => state(mount, 'top')).toEqual(['Text block', ...SEED.top]);
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['palette:start:keyboard', 'top:add:keyboard', 'top:end:keyboard']);
      await assertNothingDisappeared(mount, ['Text block']);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: Escape after hops returns the row to its origin`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Newsletter').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await assertNothingDisappeared(mount);
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'grid1')).toEqual(['Newsletter', 'Left card']);
      await assertNothingDisappeared(mount);
      await page.keyboard.press('Escape');
      await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
      await expect.poll(() => state(mount, 'content')).toEqual(SEED.content);
      await expect.poll(() => state(mount, 'grid1')).toEqual(SEED.grid1);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Cancelled. Newsletter returned to Top sidebar, position 2 of 3']);
      await expect.poll(async () => (await texts(mount.locator(LOG_LI))).at(-1)).toBe('top:end:keyboard');
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Newsletter');
      await assertNothingDisappeared(mount);
    },
  );

  // A move between lists emits `add` (destination) before `remove` (source),
  // by keyboard as by mouse — the hop and the reverse hand-off of a cancel.
  for (const burst of [false, true]) {
    runner(
      `sortable-keyboard-cross-list [${target}]: add before remove on a hop and on its cancel${burst ? ', back-to-back (no waits)' : ''}`,
      async ({ page }) => {
        const { mount } = await open(page);
        await grip(mount, 'Tag cloud').focus();
        if (burst) {
          for (const key of ['Space', 'Shift+ArrowDown', 'Escape']) await page.keyboard.press(key);
        } else {
          await page.keyboard.press('Space');
          await page.keyboard.press('Shift+ArrowDown');
          await expect.poll(() => state(mount, 'content')).toEqual(['Tag cloud', ...SEED.content]);
          await expect
            .poll(() => texts(mount.locator(LOG_LI)))
            .toEqual(['top:start:keyboard', 'content:add:keyboard', 'top:remove:keyboard']);
          await page.keyboard.press('Escape');
        }
        await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
        await expect.poll(() => state(mount, 'content')).toEqual(SEED.content);
        await expect
          .poll(() => texts(mount.locator(LOG_LI)))
          .toEqual([
            'top:start:keyboard',
            'content:add:keyboard',
            'top:remove:keyboard',
            'top:add:keyboard',
            'content:remove:keyboard',
            'top:end:keyboard',
          ]);
        await assertNothingDisappeared(mount);
      },
    );
  }

  runner(
    `sortable-keyboard-cross-list [${target}]: Escape on a clone copy removes it`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Image').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'top')).toEqual(['Image', ...SEED.top]);
      await assertNothingDisappeared(mount, ['Image']);
      await page.keyboard.press('Escape');
      await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
      await expect.poll(() => state(mount, 'palette')).toEqual(SEED.palette);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Cancelled. Image returned to Palette, position 2 of 2']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Image');
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual([
          'palette:start:keyboard',
          'top:add:keyboard',
          'top:remove:keyboard',
          'palette:end:keyboard',
        ]);
      await assertNothingDisappeared(mount);
    },
  );

  runner(`sortable-keyboard-cross-list [${target}]: burst with no waits`, async ({ page }) => {
    const { mount } = await open(page);
    await grip(mount, 'Tag cloud').focus();
    for (const key of ['Space', 'Shift+ArrowDown', 'Shift+ArrowDown', 'ArrowDown', 'Space']) {
      await page.keyboard.press(key);
    }
    await expect
      .poll(() => liveTexts(mount))
      .toEqual(['Dropped Tag cloud in Grid column 1 at position 2 of 2']);
    await expect.poll(() => state(mount, 'grid1')).toEqual(['Left card', 'Tag cloud']);
    await expect.poll(() => state(mount, 'top')).toEqual(['Search', 'Newsletter']);
    await expect.poll(() => state(mount, 'content')).toEqual(SEED.content);
    await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Tag cloud');
    await assertNothingDisappeared(mount);
  });

  runner(`sortable-keyboard-cross-list [${target}]: row mode works too`, async ({ page }) => {
    const { mount } = await open(page);
    await mount.getByTestId('mode-row').click();
    const row = mount.locator(ITEM).filter({ hasText: 'Tag cloud' });
    await expect(row).toHaveAttribute('tabindex', '0');
    await row.focus();
    await page.keyboard.press('Space');
    await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Tag cloud, position 3 of 3']);
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(() => state(mount, 'content')).toEqual(['Tag cloud', ...SEED.content]);
    await expect.poll(() => liveTexts(mount)).toEqual(['Moved Tag cloud to Content, position 1 of 5']);
    await expect.poll(() => active(page), { timeout: 5000 }).toBe('row:Tag cloud');
    await assertNothingDisappeared(mount);
    await page.keyboard.press('Space');
    await expect
      .poll(() => liveTexts(mount))
      .toEqual(['Dropped Tag cloud in Content at position 1 of 5']);
    await assertNothingDisappeared(mount);
  });

  runner(
    `sortable-keyboard-cross-list [${target}]: external items change mid-lift ends the lift without loss`,
    async ({ page }) => {
      const { mount, errors } = await open(page);
      // (1) Another list changes mid-lift: the hop still works.
      await grip(mount, 'Search').focus();
      await page.keyboard.press('Space');
      await clickKeepingFocus(mount, 'add-to-content');
      await expect.poll(() => state(mount, 'content')).toEqual([...SEED.content, 'New widget 1']);
      await assertNothingDisappeared(mount, ['New widget 1']);
      await page.keyboard.press('Shift+ArrowDown');
      await expect
        .poll(() => state(mount, 'content'))
        .toEqual(['Search', ...SEED.content, 'New widget 1']);
      await assertNothingDisappeared(mount, ['New widget 1']);
      await page.keyboard.press('Space');
      await assertNothingDisappeared(mount, ['New widget 1']);

      // (2) The consumer takes the lifted row away: the lift ends, `end`
      // still fires once, and nothing is written.
      await grip(mount, 'Newsletter').focus();
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Newsletter, position 1 of 2']);
      await clickKeepingFocus(mount, 'move-top-first-to-bottom');
      await expect.poll(() => state(mount, 'bottom')).toEqual([...SEED.bottom, 'Newsletter']);
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect.poll(() => liveTexts(mount)).toEqual(['Lift ended']);
      // Focus lands on the nearest row left in Top sidebar, never on <body>.
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Tag cloud');
      await expect
        .poll(async () => (await texts(mount.locator(LOG_LI))).slice(-2))
        .toEqual(['top:start:keyboard', 'top:end:keyboard']);
      await expect
        .poll(async () => JSON.parse((await mount.getByTestId('last-end').textContent()) || 'null'))
        .toEqual({ item: 'Newsletter', el: null, interaction: 'keyboard' });
      await assertNothingDisappeared(mount, ['New widget 1']);
      // No lift any more: Shift+↓ moves nothing.
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForTimeout(100);
      await expect.poll(() => state(mount, 'top')).toEqual(['Tag cloud']);
      await expect
        .poll(() => state(mount, 'bottom'))
        .toEqual([...SEED.bottom, 'Newsletter']);
      await assertNothingDisappeared(mount, ['New widget 1']);
      expect(errors).toEqual([]);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: emptying the list holding a lift moves focus to that list`,
    async ({ page }) => {
      const { mount, errors } = await open(page);
      await grip(mount, 'Newsletter').focus();
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Newsletter, position 2 of 3']);
      await clickKeepingFocus(mount, 'empty-top');
      await expect.poll(() => state(mount, 'top')).toEqual([]);
      await expect.poll(() => state(mount, 'bottom')).toEqual([...SEED.bottom, ...SEED.top]);
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect.poll(() => liveTexts(mount)).toEqual(['Lift ended']);
      // No row is left in Top sidebar: focus goes to the list, never <body>.
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Top sidebar');
      await expect
        .poll(async () => (await texts(mount.locator(LOG_LI))).slice(-2))
        .toEqual(['top:start:keyboard', 'top:end:keyboard']);
      await assertNothingDisappeared(mount);
      expect(errors).toEqual([]);
    },
  );

  // The list a row hops into unmounts in its own `add` handler while holding
  // the lift: it never emits again; the origin list (the `start` host) ends
  // the lift, so `start` and `end` pair.
  for (const burst of [false, true]) {
    runner(
      `sortable-keyboard-cross-list [${target}]: the origin ends a lift whose holder unmounted in its add handler${burst ? ', back-to-back (no waits)' : ''}`,
      async ({ page }) => {
        const { mount, errors } = await open(page);
        await clickKeepingFocus(mount, 'top-unmount-on-add');
        await grip(mount, 'Hero banner').focus();
        if (burst) {
          for (const key of ['Space', 'Shift+ArrowUp']) await page.keyboard.press(key);
        } else {
          await page.keyboard.press('Space');
          await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Hero banner, position 1 of 4']);
          await page.keyboard.press('Shift+ArrowUp');
        }
        await expect(mount.locator('[role="list"][aria-label="Top sidebar"]')).toHaveCount(0);
        await expect.poll(() => state(mount, 'top')).toEqual(['Search', 'Newsletter', 'Tag cloud', 'Hero banner']);
        await expect.poll(() => state(mount, 'content')).toEqual(SEED.content.filter((l) => l !== 'Hero banner'));
        await expect
          .poll(() => texts(mount.locator(LOG_LI)))
          .toEqual(['content:start:keyboard', 'top:add:keyboard', 'content:remove:keyboard', 'content:end:keyboard']);
        await page.waitForTimeout(300);
        expect(await texts(mount.locator(LOG_LI))).toEqual([
          'content:start:keyboard',
          'top:add:keyboard',
          'content:remove:keyboard',
          'content:end:keyboard',
        ]);
        await expect(mount.locator(LIFTED)).toHaveCount(0);
        await assertNothingDisappeared(mount);
        expect(errors).toEqual([]);
      },
    );
  }

  runner(
    `sortable-keyboard-cross-list [${target}]: Escape after the origin list unmounts keeps the row where it is`,
    async ({ page }) => {
      const { mount, errors } = await open(page);
      await grip(mount, 'Newsletter').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'content')).toEqual(['Newsletter', ...SEED.content]);
      await clickKeepingFocus(mount, 'toggle-top');
      await expect(grip(mount, 'Search')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Cancelled. Newsletter stays in Content, position 1 of 5']);
      await expect.poll(() => state(mount, 'content')).toEqual(['Newsletter', ...SEED.content]);
      await expect.poll(async () => (await texts(mount.locator(LOG_LI))).at(-1)).toBe('content:end:keyboard');
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await assertNothingDisappeared(mount);
      expect(errors).toEqual([]);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: Shift+↓ in an ungrouped list does nothing and moves nothing`,
    async ({ page }) => {
      await page.goto(`/?example=SortableListKeys&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      const items = mount.locator(ITEM);
      const seed = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];
      await expect(items).toHaveCount(seed.length);
      await items.nth(0).focus();
      await page.keyboard.press('Space');
      await expect(mount.locator(ARIA_LIVE)).toHaveText('Lifted Apple, position 1 of 5');
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForTimeout(100);
      await expect.poll(() => texts(mount.locator('[class*="state-list"] li'))).toEqual(seed);
      await expect(mount.locator(ARIA_LIVE)).toHaveText('Lifted Apple, position 1 of 5');
      await expect.poll(() => texts(mount.locator(LOG_LI))).toEqual(['start:keyboard']);
      await page.keyboard.press('Space');
      await expect(mount.locator(ARIA_LIVE)).toHaveText('Dropped Apple at position 1 of 5');
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: a click elsewhere keeps keys away from the lift`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Newsletter').focus();
      await page.keyboard.press('Space');
      await expect(mount.locator(LIFTED)).toHaveCount(1);
      // Click blank page: focus leaves the lifted handle for <body>.
      await mount.locator('h4').first().click();
      await expect.poll(() => active(page)).toBe('<body>');
      await page.keyboard.press('PageDown');
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForTimeout(100);
      await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
      await expect.poll(() => state(mount, 'content')).toEqual(SEED.content);
      // Today's behaviour: the lift itself stays.
      await expect(mount.locator(LIFTED)).toHaveCount(1);
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Newsletter, position 2 of 3']);
      await assertNothingDisappeared(mount);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: Escape on a clone copy after the palette unmounts removes the copy`,
    async ({ page }) => {
      const { mount, errors } = await open(page);
      await grip(mount, 'Image').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'top')).toEqual(['Image', ...SEED.top]);
      await clickKeepingFocus(mount, 'toggle-palette');
      await expect(grip(mount, 'Text block')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
      await expect.poll(() => state(mount, 'palette')).toEqual(SEED.palette);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Cancelled. Image removed from Top sidebar']);
      await expect
        .poll(async () => (await texts(mount.locator(LOG_LI))).slice(-2))
        .toEqual(['top:remove:keyboard', 'top:end:keyboard']);
      // Exactly one `end` (a target whose items watcher runs synchronously on
      // the copy's removal must not also report it as a lost lift).
      await page.waitForTimeout(150);
      expect((await texts(mount.locator(LOG_LI))).filter((e) => e.includes(':end:'))).toEqual(['top:end:keyboard']);
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect.poll(() => active(page), { timeout: 5000 }).not.toBe('<body>');
      await assertNothingDisappeared(mount);
      expect(errors).toEqual([]);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: a list of another group keeps its own keys`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Tag cloud').focus();
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Tag cloud, position 3 of 3']);
      // Toolbar A is in group 'tools': its arrows do not move the zones lift.
      await grip(mount, 'Bold').focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
      await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
      await expect.poll(() => state(mount, 'toola')).toEqual(SEED.toola);
      // Space there drops the foreign lift and lifts its own row.
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Bold, position 1 of 3']);
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['top:start:keyboard', 'top:end:keyboard', 'toola:start:keyboard']);
      await expect(mount.locator(LIFTED)).toHaveCount(1);
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => state(mount, 'toola')).toEqual(['Italic', 'Bold', 'Underline']);
      await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
      await page.keyboard.press('Space');
      await assertNothingDisappeared(mount);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: nothing hops out of a pull:false list`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Pinned notice').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => liveTexts(mount)).toEqual(['No list after Locked']);
      await page.keyboard.press('Shift+ArrowUp');
      await expect.poll(() => liveTexts(mount)).toEqual(['No list before Locked']);
      await expect.poll(() => state(mount, 'locked')).toEqual(SEED.locked);
      await expect.poll(() => state(mount, 'palette')).toEqual(SEED.palette);
      await expect(mount.locator(LIFTED)).toHaveCount(1);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Pinned notice');
      await assertNothingDisappeared(mount);
      await page.keyboard.press('Space');
      await assertNothingDisappeared(mount);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: horizontal lists hop with Shift+←/→ and move with ←/→`,
    async ({ page }) => {
      const { mount } = await open(page);
      // role="list" does not take aria-orientation; the instructions say it.
      await expect(mount.getByTestId('zone-toola').locator('[role="list"]').first()).not.toHaveAttribute(
        'aria-orientation',
        /.*/,
      );
      await expect(grip(mount, 'Bold')).toHaveAccessibleDescription(HORIZONTAL_GROUP_INSTRUCTIONS);
      await grip(mount, 'Bold').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => state(mount, 'toola')).toEqual(['Italic', 'Bold', 'Underline']);
      await expect.poll(() => liveTexts(mount)).toEqual(['Moved Bold to position 2 of 3']);
      // Vertical arrows do nothing in a horizontal list, shifted or not.
      await page.keyboard.press('Shift+ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      await expect.poll(() => state(mount, 'toola')).toEqual(['Italic', 'Bold', 'Underline']);
      await page.keyboard.press('Shift+ArrowRight');
      await expect.poll(() => state(mount, 'toolb')).toEqual(['Bold', ...SEED.toolb]);
      await expect.poll(() => state(mount, 'toola')).toEqual(['Italic', 'Underline']);
      await expect.poll(() => liveTexts(mount)).toEqual(['Moved Bold to Toolbar B, position 1 of 3']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Bold');
      await assertNothingDisappeared(mount);
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => state(mount, 'toolb')).toEqual(['Link', 'Bold', 'Quote']);
      await page.keyboard.press('Shift+ArrowLeft');
      await expect.poll(() => state(mount, 'toola')).toEqual(['Italic', 'Underline', 'Bold']);
      await expect.poll(() => liveTexts(mount)).toEqual(['Moved Bold to Toolbar A, position 3 of 3']);
      await assertNothingDisappeared(mount);
      // It hopped out and back: the drop still names the list.
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Dropped Bold in Toolbar A at position 3 of 3']);
      await assertNothingDisappeared(mount);
    },
  );

  // The `end` handler reads the bound arrays AFTER Escape's writes, in both
  // lists (React's handler closure included: `end` runs after the re-render).
  const endState = async (mount: Mount) =>
    JSON.parse((await mount.getByTestId('end-state').textContent()) || 'null');

  for (const burst of [false, true]) {
    const tag = burst ? ', back-to-back (no waits)' : '';

    runner(
      `sortable-keyboard-cross-list [${target}]: end handler sees both lists after a hop is cancelled${tag}`,
      async ({ page }) => {
        const { mount, errors } = await open(page);
        await grip(mount, 'Tag cloud').focus();
        if (burst) {
          for (const key of ['Space', 'Shift+ArrowDown', 'Escape']) await page.keyboard.press(key);
        } else {
          await page.keyboard.press('Space');
          await page.keyboard.press('Shift+ArrowDown');
          await expect.poll(() => state(mount, 'content')).toEqual(['Tag cloud', ...SEED.content]);
          await page.keyboard.press('Escape');
        }
        await expect
          .poll(() => liveTexts(mount))
          .toEqual(['Cancelled. Tag cloud returned to Top sidebar, position 3 of 3']);
        await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
        await expect.poll(() => state(mount, 'content')).toEqual(SEED.content);
        await expect
          .poll(() => endState(mount))
          .toEqual({ palette: SEED.palette, top: SEED.top, content: SEED.content });
        await expect.poll(async () => (await texts(mount.locator(LOG_LI))).at(-1)).toBe('top:end:keyboard');
        await assertNothingDisappeared(mount);
        expect(errors).toEqual([]);
      },
    );

    runner(
      `sortable-keyboard-cross-list [${target}]: end handler sees the clone copy removed on Escape${tag}`,
      async ({ page }) => {
        const { mount, errors } = await open(page);
        await grip(mount, 'Text block').focus();
        if (burst) {
          for (const key of ['Space', 'Shift+ArrowDown', 'Escape']) await page.keyboard.press(key);
        } else {
          await page.keyboard.press('Space');
          await page.keyboard.press('Shift+ArrowDown');
          await expect.poll(() => state(mount, 'top')).toEqual(['Text block', ...SEED.top]);
          await page.keyboard.press('Escape');
        }
        await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
        await expect.poll(() => state(mount, 'palette')).toEqual(SEED.palette);
        await expect
          .poll(() => endState(mount))
          .toEqual({ palette: SEED.palette, top: SEED.top, content: SEED.content });
        await expect.poll(async () => (await texts(mount.locator(LOG_LI))).at(-1)).toBe('palette:end:keyboard');
        await assertNothingDisappeared(mount);
        expect(errors).toEqual([]);
      },
    );
  }

  // Lit too: component events stay on the element that emits them (no
  // bubbling, no shadow-root crossing), as on the other five targets.
  runner(
    `sortable-keyboard-cross-list [${target}]: a nested inner list's events do not reach the outer list's listeners`,
    async ({ page }) => {
      const { mount, errors } = await open(page);
      // Grid column 1 holds one row; hop it to column 2 by keyboard, then
      // reorder inside column 2 and drop. Only the grid lists may log anything.
      await grip(mount, 'Left card').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'grid2')).toEqual(['Left card', 'Right card']);
      await page.keyboard.press('ArrowDown');
      await expect.poll(() => state(mount, 'grid2')).toEqual(['Right card', 'Left card']);
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      const log = await texts(mount.locator(LOG_LI));
      expect(log.length).toBeGreaterThan(0);
      expect(log.filter((e) => !e.startsWith('grid1:') && !e.startsWith('grid2:'))).toEqual([]);
      expect(errors).toEqual([]);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: custom instructions are used`,
    async ({ page }) => {
      const { mount } = await open(page);
      await expect(grip(mount, 'Search')).toHaveAccessibleDescription(TOP_INSTRUCTIONS);
      await expect(grip(mount, 'Hero banner')).toHaveAccessibleDescription(GROUP_INSTRUCTIONS);
    },
  );

  // The palette sets its group only through `options.group` (the docs'
  // palette recipe): its rows leave only by Shift+arrow, so it says so.
  runner(
    `sortable-keyboard-cross-list [${target}]: options.group palette instructions mention Shift`,
    async ({ page }) => {
      const { mount } = await open(page);
      await expect(grip(mount, 'Text block')).toHaveAccessibleDescription(GROUP_INSTRUCTIONS);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: horizontal instructions say left and right`,
    async ({ page }) => {
      const { mount } = await open(page);
      await expect(grip(mount, 'Link')).toHaveAccessibleDescription(HORIZONTAL_GROUP_INSTRUCTIONS);
      await expect(grip(mount, 'Link')).toHaveAccessibleDescription(/Use the left and right arrow keys to move/);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: the consumer swapping the lifted item for a same-key object keeps the lift`,
    async ({ page }) => {
      const { mount, errors } = await open(page);
      await grip(mount, 'Newsletter').focus();
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Newsletter, position 2 of 3']);
      await clickKeepingFocus(mount, 'replace-newsletter');
      await page.waitForTimeout(100);
      await expect(mount.locator(LIFTED)).toHaveCount(1);
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Newsletter, position 2 of 3']);
      await page.keyboard.press('ArrowDown');
      await expect.poll(() => state(mount, 'top')).toEqual(['Search', 'Tag cloud', 'Newsletter']);
      await expect.poll(() => liveTexts(mount)).toEqual(['Moved Newsletter to position 3 of 3']);
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Dropped Newsletter at position 3 of 3']);
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['top:start:keyboard', 'top:reorder:keyboard', 'top:end:keyboard']);
      await assertNothingDisappeared(mount);
      expect(errors).toEqual([]);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: re-keying the lifted item ends the lift without stranding focus`,
    async ({ page }) => {
      const { mount, errors } = await open(page);
      await grip(mount, 'Newsletter').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'content')).toEqual(['Newsletter', ...SEED.content]);
      await clickKeepingFocus(mount, 'rekey-newsletter');
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect.poll(() => liveTexts(mount)).toEqual(['Lift ended']);
      await expect.poll(() => active(page), { timeout: 5000 }).not.toBe('<body>');
      await expect
        .poll(async () => (await texts(mount.locator(LOG_LI))).filter((e) => e.endsWith(':end:keyboard')))
        .toEqual(['content:end:keyboard']);
      await expect
        .poll(async () => JSON.parse((await mount.getByTestId('last-end').textContent()) || 'null'))
        .toEqual({ item: 'Newsletter', el: null, interaction: 'keyboard' });
      await assertNothingDisappeared(mount);
      // No lift any more: arrows move nothing.
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      await expect.poll(() => state(mount, 'content')).toEqual(['Newsletter', ...SEED.content]);
      await assertNothingDisappeared(mount);
      expect(errors).toEqual([]);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: a put:false palette is never a hop target`,
    async ({ page }) => {
      const { mount } = await open(page);
      // Source order before Top sidebar: Locked, then Palette. Palette takes
      // nothing (put: false), so Shift+↑ reaches Locked.
      await grip(mount, 'Search').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowUp');
      await expect.poll(() => state(mount, 'locked')).toEqual([...SEED.locked, 'Search']);
      await expect.poll(() => liveTexts(mount)).toEqual(['Moved Search to Locked, position 2 of 2']);
      await expect.poll(() => state(mount, 'palette')).toEqual(SEED.palette);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Search');
      await assertNothingDisappeared(mount);
      await page.keyboard.press('Escape');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Cancelled. Search returned to Top sidebar, position 1 of 3']);
      await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
      await expect.poll(() => state(mount, 'palette')).toEqual(SEED.palette);
      await assertNothingDisappeared(mount);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: keys on another row of a same-group list leave the lift alone`,
    async ({ page }) => {
      const { mount } = await open(page);
      await grip(mount, 'Search').focus();
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Search, position 1 of 3']);
      await grip(mount, 'Hero banner').focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForTimeout(100);
      await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
      await expect.poll(() => state(mount, 'content')).toEqual(SEED.content);
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Search, position 1 of 3']);
      // Space there drops the Top lift and lifts its own row.
      await page.keyboard.press('Space');
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Hero banner, position 1 of 4']);
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['top:start:keyboard', 'top:end:keyboard', 'content:start:keyboard']);
      await page.keyboard.press('ArrowDown');
      await expect.poll(() => state(mount, 'content')).toEqual(['Intro text', 'Hero banner', 'Grid', 'Gallery']);
      await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
      await page.keyboard.press('Space');
      await assertNothingDisappeared(mount);
    },
  );

  runner(
    `sortable-keyboard-cross-list [${target}]: Escape when the origin list is hidden keeps the row where it is`,
    async ({ page }) => {
      const { mount, errors } = await open(page);
      await grip(mount, 'Newsletter').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'content')).toEqual(['Newsletter', ...SEED.content]);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Newsletter');
      await clickKeepingFocus(mount, 'hide-top');
      await expect(grip(mount, 'Search')).toBeHidden();
      await page.keyboard.press('Escape');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Cancelled. Newsletter stays in Content, position 1 of 5']);
      await expect.poll(() => state(mount, 'content')).toEqual(['Newsletter', ...SEED.content]);
      await expect.poll(() => state(mount, 'top')).toEqual(['Search', 'Tag cloud']);
      await expect.poll(async () => (await texts(mount.locator(LOG_LI))).at(-1)).toBe('content:end:keyboard');
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Newsletter');
      await assertNothingDisappeared(mount);
      expect(errors).toEqual([]);
    },
  );

  for (const burst of [false, true]) {
    const tag = burst ? ', back-to-back (no waits)' : '';

    // `options.sort: false`: no in-list moves by keyboard (as by mouse), but
    // the row still hops by the group's pull / put.
    runner(
      `sortable-keyboard-cross-list [${target}]: sort:false list ignores arrow moves but still hops${tag}`,
      async ({ page }) => {
        const { mount, errors } = await open(page);
        await clickKeepingFocus(mount, 'top-no-sort');
        // SortableJS reads options at construction: remount Top sidebar.
        await clickKeepingFocus(mount, 'toggle-top');
        await expect(grip(mount, 'Search')).toHaveCount(0);
        await clickKeepingFocus(mount, 'toggle-top');
        await expect(grip(mount, 'Search')).toBeVisible();
        await grip(mount, 'Search').focus();
        if (burst) {
          for (const key of ['Space', 'ArrowDown', 'End', 'PageDown', 'ArrowDown']) await page.keyboard.press(key);
        } else {
          await page.keyboard.press('Space');
          await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Search, position 1 of 3']);
          for (const key of ['ArrowDown', 'End', 'PageDown', 'ArrowDown']) await page.keyboard.press(key);
          await page.waitForTimeout(100);
          await expect.poll(() => liveTexts(mount)).toEqual(["Search can't be moved within Top sidebar"]);
        }
        await expect.poll(() => state(mount, 'top')).toEqual(SEED.top);
        await expect(mount.locator(LIFTED)).toHaveCount(1);
        await page.keyboard.press('Shift+ArrowDown');
        await expect.poll(() => state(mount, 'content')).toEqual(['Search', ...SEED.content]);
        await expect.poll(() => state(mount, 'top')).toEqual(['Newsletter', 'Tag cloud']);
        await expect.poll(() => liveTexts(mount)).toEqual(['Moved Search to Content, position 1 of 5']);
        await assertNothingDisappeared(mount);
        // Content sorts: the arrow moves the row there.
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => state(mount, 'content')).toEqual(['Hero banner', 'Search', 'Intro text', 'Grid', 'Gallery']);
        await page.keyboard.press('Space');
        await expect.poll(() => liveTexts(mount)).toEqual(['Dropped Search in Content at position 2 of 5']);
        expect(
          (await texts(mount.locator(LOG_LI))).filter((e) => e.startsWith('top:reorder')),
        ).toEqual([]);
        await assertNothingDisappeared(mount);
        expect(errors).toEqual([]);
      },
    );

    // Two same-group lists whose rows share keys (index keys): a key on the
    // other list's row with the lifted row's key is that row's own key.
    runner(
      `sortable-keyboard-cross-list [${target}]: same key in another list does not hijack keys${tag}`,
      async ({ page }) => {
        const { mount, errors } = await open(page);
        await clickKeepingFocus(mount, 'tools-index-keys');
        await expect
          .poll(() =>
            mount
              .getByTestId('zone-toolb')
              .locator(ITEM)
              .evaluateAll((els) => els.map((el) => el.getAttribute('data-id'))),
          )
          .toEqual(['0', '1']);
        await grip(mount, 'Bold').focus();
        await page.keyboard.press('Space');
        await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Bold, position 1 of 3']);
        // Link is Toolbar B's row 0: the same key as the lifted Bold.
        await grip(mount, 'Link').focus();
        if (burst) {
          for (const key of ['ArrowRight', 'ArrowRight']) await page.keyboard.press(key);
        } else {
          await page.keyboard.press('ArrowRight');
          await page.keyboard.press('ArrowRight');
        }
        await page.waitForTimeout(100);
        await expect.poll(() => state(mount, 'toola')).toEqual(SEED.toola);
        await expect.poll(() => state(mount, 'toolb')).toEqual(SEED.toolb);
        await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Bold, position 1 of 3']);
        await expect(mount.getByTestId('zone-toola').locator(LIFTED)).toHaveCount(1);
        // Space there drops Bold where it is and lifts Link.
        if (burst) {
          for (const key of ['Space', 'ArrowRight', 'Space']) await page.keyboard.press(key);
          await expect.poll(() => liveTexts(mount)).toEqual(['Dropped Link at position 2 of 2']);
        } else {
          await page.keyboard.press('Space');
          await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Link, position 1 of 2']);
          await page.keyboard.press('ArrowRight');
          await expect.poll(() => liveTexts(mount)).toEqual(['Moved Link to position 2 of 2']);
          await page.keyboard.press('Space');
        }
        await expect.poll(() => state(mount, 'toolb')).toEqual(['Quote', 'Link']);
        await expect.poll(() => state(mount, 'toola')).toEqual(SEED.toola);
        await expect
          .poll(() => texts(mount.locator(LOG_LI)))
          .toEqual([
            'toola:start:keyboard',
            'toola:end:keyboard',
            'toolb:start:keyboard',
            'toolb:reorder:keyboard',
            'toolb:end:keyboard',
          ]);
        await assertNothingDisappeared(mount);
        expect(errors).toEqual([]);
      },
    );

    // Index keys: after Bold hops out, Toolbar A may reuse Bold's old row
    // element for Italic. Keys there are Italic's, not the lift's.
    runner(
      `sortable-keyboard-cross-list [${target}]: a reused row element after a hop is not the lifted row${tag}`,
      async ({ page }) => {
        const { mount, errors } = await open(page);
        await clickKeepingFocus(mount, 'tools-index-keys');
        await expect
          .poll(() =>
            mount
              .getByTestId('zone-toola')
              .locator(ITEM)
              .evaluateAll((els) => els.map((el) => el.getAttribute('data-id'))),
          )
          .toEqual(['0', '1', '2']);
        await grip(mount, 'Bold').focus();
        if (burst) {
          for (const key of ['Space', 'Shift+ArrowRight']) await page.keyboard.press(key);
        } else {
          await page.keyboard.press('Space');
          await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Bold, position 1 of 3']);
          await page.keyboard.press('Shift+ArrowRight');
        }
        await expect.poll(() => state(mount, 'toolb')).toEqual(['Bold', ...SEED.toolb]);
        await expect.poll(() => state(mount, 'toola')).toEqual(['Italic', 'Underline']);
        await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Bold');
        // Italic now sits at Toolbar A's row 0 (Bold's old position and key).
        await grip(mount, 'Italic').focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(100);
        await expect.poll(() => state(mount, 'toolb')).toEqual(['Bold', ...SEED.toolb]);
        await expect.poll(() => state(mount, 'toola')).toEqual(['Italic', 'Underline']);
        await expect.poll(() => liveTexts(mount)).toEqual(['Moved Bold to Toolbar B, position 1 of 3']);
        // Space there drops Bold and lifts Italic.
        await page.keyboard.press('Space');
        await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Italic, position 1 of 2']);
        await page.keyboard.press('Escape');
        await expect.poll(() => liveTexts(mount)).toEqual(['Cancelled. Italic returned to position 1 of 2']);
        await expect.poll(() => state(mount, 'toola')).toEqual(['Italic', 'Underline']);
        await expect.poll(() => state(mount, 'toolb')).toEqual(['Bold', ...SEED.toolb]);
        await assertNothingDisappeared(mount);
        expect(errors).toEqual([]);
      },
    );
  }
}
