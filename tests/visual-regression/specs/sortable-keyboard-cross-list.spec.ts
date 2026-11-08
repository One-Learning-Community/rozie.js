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

const SLUGS = ['palette', 'top', 'content', 'grid1', 'grid2', 'bottom', 'archive', 'hidden'] as const;
type Slug = (typeof SLUGS)[number];

const SEED: Record<Slug, string[]> = {
  palette: ['Text block', 'Image'],
  top: ['Search', 'Newsletter', 'Tag cloud'],
  content: ['Hero banner', 'Intro text', 'Grid', 'Gallery'],
  grid1: ['Left card'],
  grid2: ['Right card'],
  bottom: ['Recent posts', 'Contact'],
  archive: ['Old promo'],
  hidden: ['Hidden widget'],
};
const SEED_LABELS = Object.values(SEED).flat();

const TOP_INSTRUCTIONS =
  'Press Space to pick up this widget. Shift with an arrow key moves it to another zone.';
const GROUP_INSTRUCTIONS =
  'Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel. Hold Shift with an arrow key to move to another list.';

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
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Tag cloud']);
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'content')).toEqual(['Tag cloud', ...SEED.content]);
      await expect.poll(() => state(mount, 'top')).toEqual(['Search', 'Newsletter']);
      await expect.poll(() => liveTexts(mount)).toEqual(['Moved Tag cloud to Content, position 1']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Tag cloud');
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['top:start:keyboard', 'top:remove:keyboard', 'content:add:keyboard']);
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Tag cloud in Content at position 1']);
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect.poll(async () => (await texts(mount.locator(LOG_LI))).at(-1)).toBe('content:end:keyboard');
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
        .toEqual(['Moved Hero banner to Top sidebar, position 4']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Hero banner');
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Hero banner in Top sidebar at position 4']);
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
        .toEqual(['Moved Intro text to Grid column 1, position 1']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Intro text');
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'grid2')).toEqual(['Intro text', 'Right card']);
      await expect.poll(() => state(mount, 'grid1')).toEqual(['Left card']);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Moved Intro text to Grid column 2, position 1']);
      await assertNothingDisappeared(mount);

      await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(() => state(mount, 'bottom')).toEqual(['Intro text', ...SEED.bottom]);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Moved Intro text to Bottom sidebar, position 1']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Intro text');
      await assertNothingDisappeared(mount);

      // And back up again: Bottom sidebar → Grid column 2 (lands last).
      await page.keyboard.press('Shift+ArrowUp');
      await expect.poll(() => state(mount, 'grid2')).toEqual(['Right card', 'Intro text']);
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Moved Intro text to Grid column 2, position 2']);
      await assertNothingDisappeared(mount);
      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Intro text in Grid column 2 at position 2']);
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
      await expect.poll(() => liveTexts(mount)).toEqual(['Moved Grid to Bottom sidebar, position 1']);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Grid');
      // The columns travelled with the Grid row.
      await expect(grip(mount, 'Left card')).toBeVisible();
      await assertNothingDisappeared(mount);
      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Grid in Bottom sidebar at position 1']);
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
        .toEqual(['Cancelled. Contact returned to position 2']);
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
        .toEqual(['Moved Text block to Top sidebar, position 1']);
      await assertNothingDisappeared(mount, ['Text block']);
      await page.keyboard.press('Space');
      await expect
        .poll(() => liveTexts(mount))
        .toEqual(['Dropped Text block in Top sidebar at position 1']);
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
        .toEqual(['Cancelled. Newsletter returned to Top sidebar, position 2']);
      await expect.poll(async () => (await texts(mount.locator(LOG_LI))).at(-1)).toBe('top:end:keyboard');
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect.poll(() => active(page), { timeout: 5000 }).toBe('Reorder Newsletter');
      await assertNothingDisappeared(mount);
    },
  );

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
        .toEqual(['Cancelled. Image returned to Palette, position 2']);
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
      .toEqual(['Dropped Tag cloud in Grid column 1 at position 2']);
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
    await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Tag cloud']);
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(() => state(mount, 'content')).toEqual(['Tag cloud', ...SEED.content]);
    await expect.poll(() => liveTexts(mount)).toEqual(['Moved Tag cloud to Content, position 1']);
    await expect.poll(() => active(page), { timeout: 5000 }).toBe('row:Tag cloud');
    await assertNothingDisappeared(mount);
    await page.keyboard.press('Space');
    await expect
      .poll(() => liveTexts(mount))
      .toEqual(['Dropped Tag cloud in Content at position 1']);
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
      await expect.poll(() => liveTexts(mount)).toEqual(['Lifted Newsletter']);
      await clickKeepingFocus(mount, 'move-top-first-to-bottom');
      await expect.poll(() => state(mount, 'bottom')).toEqual([...SEED.bottom, 'Newsletter']);
      await expect(mount.locator(LIFTED)).toHaveCount(0);
      await expect
        .poll(async () => (await texts(mount.locator(LOG_LI))).slice(-2))
        .toEqual(['top:start:keyboard', 'top:end:keyboard']);
      await assertNothingDisappeared(mount, ['New widget 1']);
      await page.keyboard.press('Shift+ArrowDown');
      await page.keyboard.press('Space');
      await expect.poll(() => state(mount, 'top')).toEqual(['Tag cloud']);
      await expect
        .poll(() => state(mount, 'bottom'))
        .toEqual([...SEED.bottom, 'Newsletter']);
      await assertNothingDisappeared(mount, ['New widget 1']);
      expect(errors).toEqual([]);
    },
  );

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
        .toEqual(['Cancelled. Newsletter stays in Content, position 1']);
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
      await expect(mount.locator(ARIA_LIVE)).toHaveText('Lifted Apple');
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForTimeout(100);
      await expect.poll(() => texts(mount.locator('[class*="state-list"] li'))).toEqual(seed);
      await expect(mount.locator(ARIA_LIVE)).toHaveText('Lifted Apple');
      await expect.poll(() => texts(mount.locator(LOG_LI))).toEqual(['start:keyboard']);
      await page.keyboard.press('Space');
      await expect(mount.locator(ARIA_LIVE)).toHaveText('Dropped Apple at position 1');
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
}
