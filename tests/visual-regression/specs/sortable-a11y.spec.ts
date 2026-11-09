import { test, expect, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeDrag } from '../host/dragEvent';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * sortable-a11y — SortableList's accessibility structure on every target:
 *   - the spoken-instructions id: one per list, referenced by the list's rows
 *     once mounted (it is assigned at mount, so server and first client render
 *     agree);
 *   - `#header` / `#footer` content is not part of the `role="list"` element:
 *     the list's children in the accessibility tree are its rows only;
 *   - Lit: a mounted `<rozie-sortable-list>` taken out of the page and put back
 *     still drags and reorders by keyboard, with each event once.
 *
 * Fixtures: SortableListZones (many row-mode lists after `mode-row`, remounts
 * via `toggle-top`), SortableListKeys (one list with `#header` and `#footer`).
 * STRUCTURAL assertions only — no screenshots.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const ITEM = '[class*="rozie-sortable-item"]';
const ARIA_LIVE = '[data-rozie-sortable-aria-live]';
const STATE_LI = '[class*="state-list"] li';
const LOG_LI = '[class*="event-log"] li';

const SEED = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];

function texts(locator: Locator) {
  return locator.evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
}

function labels(locator: Locator) {
  return locator.evaluateAll((els) =>
    els.map((el) => ((el.querySelector('[class*="label"]') ?? el).textContent ?? '').trim()),
  );
}

/**
 * Every SortableList on the page (walking open shadow roots): its
 * instructions element id, whether that id resolves in the list's own root,
 * and the `aria-describedby` of each of its tabbable rows.
 */
function instructionLinks(page: Page) {
  return page.evaluate(() => {
    const wraps: Element[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.classList.contains('rozie-sortable-wrap')) wraps.push(el);
        if ((el as HTMLElement).shadowRoot) walk((el as HTMLElement).shadowRoot!);
      }
    };
    walk(document);
    return wraps.map((wrap) => {
      const span = Array.from(wrap.children).find((c) => c.tagName === 'SPAN' && c.hasAttribute('hidden'));
      const list = Array.from(wrap.children).find((c) => c.getAttribute('role') === 'list');
      const id = span?.getAttribute('id') ?? null;
      const root = wrap.getRootNode() as Document | ShadowRoot;
      const rows = Array.from(list?.children ?? []).filter(
        (c) => c.classList.contains('rozie-sortable-item') && c.hasAttribute('tabindex'),
      );
      return {
        id,
        resolves: id != null && root.getElementById(id) === span,
        describedBy: rows.map((r) => r.getAttribute('aria-describedby')),
      };
    });
  });
}

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  const runner = !built ? test.fixme : test;

  async function openKeys(page: Page) {
    await page.goto(`/?example=SortableListKeys&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    const items = mount.locator(ITEM);
    await expect(items).toHaveCount(SEED.length);
    await expect(items.first()).toHaveAttribute('tabindex', '0');
    return { mount, items, aria: mount.locator(ARIA_LIVE) };
  }

  runner(`sortable-a11y [${target}]: instructions id is unique per list and referenced after mount`, async ({ page }) => {
    await page.goto(`/?example=SortableListZones&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await mount.getByTestId('mode-row').evaluate((b) => (b as HTMLElement).click());
    await expect(mount.locator(ITEM).first()).toHaveAttribute('tabindex', '0');

    const check = async () => {
      const links = await instructionLinks(page);
      expect(links.length).toBeGreaterThan(2);
      const ids = links.map((l) => l.id);
      expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
      for (const l of links) {
        expect(l.resolves).toBe(true);
        expect(l.describedBy.every((d) => d === l.id)).toBe(true);
      }
      expect(links.some((l) => l.describedBy.length > 0)).toBe(true);
      return ids;
    };
    await expect.poll(async () => (await instructionLinks(page)).every((l) => l.id != null)).toBe(true);
    const before = await check();

    // A list unmounted and mounted again gets an id no other list has.
    await mount.getByTestId('toggle-top').evaluate((b) => (b as HTMLElement).click());
    await expect.poll(async () => (await instructionLinks(page)).length).toBe(before.length - 1);
    await mount.getByTestId('toggle-top').evaluate((b) => (b as HTMLElement).click());
    await expect.poll(async () => (await instructionLinks(page)).length).toBe(before.length);
    await expect.poll(async () => (await instructionLinks(page)).every((l) => l.id != null)).toBe(true);
    await expect(mount.locator(ITEM).first()).toHaveAttribute('tabindex', '0');
    await check();
  });

  runner(`sortable-a11y [${target}]: header and footer do not break the list's children`, async ({ page }) => {
    const { mount } = await openKeys(page);
    await expect(mount.locator('[class*="list-header"]')).toHaveText('Fruit (5)');
    await expect(mount.locator('[class*="list-footer"]')).toHaveText('End of list');
    const list = mount.getByRole('list', { name: 'Fruit' });
    await expect(list).toHaveCount(1);
    const snapshot = await list.ariaSnapshot();
    const lines = snapshot.split('\n');
    expect(lines[0]).toMatch(/^- list "Fruit"/);
    // The list's direct children (one level of indent) are its rows only.
    const children = lines.filter((l) => /^ {2}- /.test(l));
    expect(children.length).toBe(SEED.length);
    for (const line of children) expect(line).toMatch(/^ {2}- listitem\b/);
    expect(snapshot).not.toContain('Fruit (5)');
    expect(snapshot).not.toContain('End of list');
    // Header first, footer last, around the list.
    const order = await mount.evaluate((root) => {
      const all: string[] = [];
      const walk = (n: Node) => {
        if (n instanceof Element) {
          const c = n.getAttribute('class') ?? '';
          if (c.includes('list-header')) all.push('header');
          else if (c.includes('list-footer')) all.push('footer');
          else if (n.getAttribute('role') === 'list') all.push('list');
          if ((n as HTMLElement).shadowRoot) {
            // Lit: walk the composed tree (slotted light-DOM content where its slot sits).
            for (const k of Array.from((n as HTMLElement).shadowRoot!.childNodes)) walk(k);
            return;
          }
          if (n.tagName === 'SLOT') {
            for (const k of (n as HTMLSlotElement).assignedNodes({ flatten: true })) walk(k);
          }
        }
        for (const k of Array.from(n.childNodes)) walk(k);
      };
      walk(root);
      return all;
    });
    expect(order).toEqual(['header', 'list', 'footer']);
  });

  if (target === 'lit') {
    /** Take the SortableList out of the page, wait a task, put it back where it was. */
    async function detachAndReattach(page: Page) {
      await page.evaluate(async () => {
        const find = (root: Document | ShadowRoot): Element | null => {
          for (const el of Array.from(root.querySelectorAll('*'))) {
            if (el.tagName === 'ROZIE-SORTABLE-LIST') return el;
            const sr = (el as HTMLElement).shadowRoot;
            if (sr) {
              const hit = find(sr);
              if (hit) return hit;
            }
          }
          return null;
        };
        const el = find(document)!;
        const parent = el.parentNode!;
        const next = el.nextSibling;
        el.remove();
        await new Promise((r) => setTimeout(r, 50));
        parent.insertBefore(el, next);
        await new Promise((r) => setTimeout(r, 50));
      });
    }

    runner(`sortable-a11y [lit]: a list moved in the DOM still drags and reorders by keyboard`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      const { mount, items, aria } = await openKeys(page);
      // Twice: each reconnect sets the list up once, never doubled.
      await detachAndReattach(page);
      await detachAndReattach(page);
      await expect(items).toHaveCount(SEED.length);

      // Keyboard.
      await items.nth(0).focus();
      await page.keyboard.press('Space');
      await expect(aria).toHaveText(/^Lifted Apple/);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      await expect(aria).toHaveText('Dropped Apple at position 2 of 5');
      await expect.poll(() => labels(items)).toEqual(['Banana', 'Apple', 'Cherry', 'Date', 'Elderberry']);
      await expect.poll(() => texts(mount.locator(STATE_LI))).toEqual(['Banana', 'Apple', 'Cherry', 'Date', 'Elderberry']);
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['start:keyboard', 'reorder:keyboard', 'end:keyboard']);

      // Pointer.
      await synthesizeDrag(page, {
        sourceHandle: items.nth(0).locator('[class*="label"]'),
        target: items.nth(2),
      });
      await expect.poll(() => labels(items)).toEqual(['Apple', 'Cherry', 'Banana', 'Date', 'Elderberry']);
      await expect.poll(() => texts(mount.locator(STATE_LI))).toEqual(['Apple', 'Cherry', 'Banana', 'Date', 'Elderberry']);
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual([
          'start:keyboard', 'reorder:keyboard', 'end:keyboard',
          'start:pointer', 'reorder:pointer', 'end:pointer',
        ]);
      expect(errors).toEqual([]);
    });

    /**
     * Move the SortableList within its parent in ONE task (disconnect and
     * reconnect with no task between: a re-append), and report how many
     * keyboard-registry entries point at its list element afterwards.
     */
    async function moveInOneTask(page: Page) {
      return page.evaluate(async () => {
        const find = (root: Document | ShadowRoot): Element | null => {
          for (const el of Array.from(root.querySelectorAll('*'))) {
            if (el.tagName === 'ROZIE-SORTABLE-LIST') return el;
            const sr = (el as HTMLElement).shadowRoot;
            if (sr) {
              const hit = find(sr);
              if (hit) return hit;
            }
          }
          return null;
        };
        const el = find(document)!;
        const parent = el.parentNode!;
        const next = el.nextSibling;
        parent.appendChild(el);
        parent.insertBefore(el, next);
        await new Promise((r) => setTimeout(r, 50));
        const listEl = el.shadowRoot!.querySelector('[role="list"]');
        const reg = (globalThis as any)[Symbol.for('rozie.sortable-list.keyboard.v1')].registry;
        return reg.orderedLists().filter((e: { el: Element }) => e.el === listEl).length;
      });
    }

    runner(`sortable-a11y [lit]: a list moved in the DOM within one task keeps one setup and still works`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      const { mount, items, aria } = await openKeys(page);
      expect(await moveInOneTask(page)).toBe(1);
      expect(await moveInOneTask(page)).toBe(1);
      await expect(items).toHaveCount(SEED.length);

      // Keyboard: one `start`, one `reorder`, one `end` (one registry entry).
      await items.nth(0).focus();
      await page.keyboard.press('Space');
      await expect(aria).toHaveText(/^Lifted Apple/);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      await expect(aria).toHaveText('Dropped Apple at position 2 of 5');
      await expect.poll(() => labels(items)).toEqual(['Banana', 'Apple', 'Cherry', 'Date', 'Elderberry']);
      await expect.poll(() => texts(mount.locator(STATE_LI))).toEqual(['Banana', 'Apple', 'Cherry', 'Date', 'Elderberry']);

      // Pointer: one set of events (one SortableJS instance).
      await synthesizeDrag(page, {
        sourceHandle: items.nth(0).locator('[class*="label"]'),
        target: items.nth(2),
      });
      await expect.poll(() => labels(items)).toEqual(['Apple', 'Cherry', 'Banana', 'Date', 'Elderberry']);
      await expect.poll(() => texts(mount.locator(STATE_LI))).toEqual(['Apple', 'Cherry', 'Banana', 'Date', 'Elderberry']);
      await page.waitForTimeout(150);
      expect(await texts(mount.locator(LOG_LI))).toEqual([
        'start:keyboard', 'reorder:keyboard', 'end:keyboard',
        'start:pointer', 'reorder:pointer', 'end:pointer',
      ]);
      expect(errors).toEqual([]);
    });

    // A runtime `option()` set before the move applies to the SortableJS
    // instance built on reconnect too, not only to the keyboard.
    runner(`sortable-a11y [lit]: option('sort', false) survives a move in the DOM for the mouse`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      const { mount, items } = await openKeys(page);
      await mount.getByTestId('sort-off').evaluate((b) => (b as HTMLElement).click());
      await detachAndReattach(page);
      await expect(items).toHaveCount(SEED.length);
      await synthesizeDrag(page, {
        sourceHandle: items.nth(0).locator('[class*="label"]'),
        target: items.nth(2),
      });
      await page.waitForTimeout(150);
      await expect.poll(() => labels(items)).toEqual(SEED);
      await expect.poll(() => texts(mount.locator(STATE_LI))).toEqual(SEED);
      expect((await texts(mount.locator(LOG_LI))).filter((e) => e.startsWith('reorder:'))).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
