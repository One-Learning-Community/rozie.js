import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeDrag, synthesizeDrag } from '../host/dragEvent';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * sortable-drag-cross — cross-list drag for SortableListPairDemo.
 *
 * The third runtime-behavior gate in the SortableJS spec set:
 *   - `sortable-drag.spec.ts` — single in-list reorder (one list)
 *   - `sortable-drag-multi.spec.ts` — consecutive in-list reorders (one list)
 *   - this file — cross-list drag (two lists sharing a group)
 *
 * SortableListPairDemo mounts two SortableList instances sharing
 * `group="kanban"`. The first list (`$data.todo`) seeds 3 items
 * (Write spec / Build prototype / Sketch UI). The second list
 * (`$data.doing`) seeds 2 items (Ship the demo / Review PR). The
 * `examples/sortable-transfer.js` module-level slot is what lets the
 * destination list look up the item the source list is dragging — without
 * it, `onAdd(e)` on the destination only knows WHERE the item landed,
 * not WHAT it is. This spec drives a synthetic drag from list A's first
 * row onto list B's first row and asserts both bound arrays update
 * (A loses the item, B gains it) across all 6 targets.
 *
 * Conventions
 * -----------
 * Mirrors the existing `sortable-drag.spec.ts` patterns:
 *   - 6-target loop with `existsSync` build-availability gate + `test.fixme`.
 *   - Structural assertions only — no `toHaveScreenshot` (macOS-friendly).
 *   - Substring `[class*="…"]` locators (survive React CSS-Modules hashing
 *     and pierce Lit's shadow DOM).
 *   - Distinct list anchors via the demo's `.list-pane` wrappers so the
 *     two SortableList instances can be addressed independently.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

// SortableListPairDemo seeds 3 todo + 2 doing items on $onMount.
const SEED_TODO_COUNT = 3;
const SEED_DOING_COUNT = 2;

const ITEM = '[class*="rozie-sortable-item"]';
const GRIP = '[class*="grip"]';
const LIST_PANE = '[class*="list-pane"]';

/** Read row labels inside a `.list-pane` section in DOM order. */
function paneLabels(locator: ReturnType<import('@playwright/test').Page['locator']>) {
  return locator.evaluateAll((els) =>
    els.map((el) => {
      const label = el.querySelector('[class*="label"]');
      return ((label ?? el).textContent ?? '').trim();
    }),
  );
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  runner(
    `sortable-drag-cross [${target}]: dragging from list A to list B updates both bound arrays`,
    async ({ page }) => {
      await page.goto(`/?example=SortableListPair&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();

      // Two list-pane wrappers; first is `$data.todo`, second is
      // `$data.doing`. Address each list's rows via the pane locator so
      // the GRIP / ITEM matchers pick the right SortableList instance.
      const panes = mount.locator(LIST_PANE);
      await expect(panes).toHaveCount(2);
      const todoPane = panes.nth(0);
      const doingPane = panes.nth(1);

      const todoItems = todoPane.locator(ITEM);
      const doingItems = doingPane.locator(ITEM);
      await expect(todoItems).toHaveCount(SEED_TODO_COUNT);
      await expect(doingItems).toHaveCount(SEED_DOING_COUNT);

      const todoBefore = await paneLabels(todoItems);
      const doingBefore = await paneLabels(doingItems);
      expect(todoBefore).toHaveLength(SEED_TODO_COUNT);
      expect(doingBefore).toHaveLength(SEED_DOING_COUNT);

      // Drag the FIRST todo row onto the FIRST doing row. The architectural
      // invariants are:
      //   1. Source list (todo) loses the dragged item
      //   2. Destination list (doing) gains the dragged item
      //   3. Total count is conserved
      //   4. The non-dragged source items keep their relative order
      // Exact destination INDEX is dependent on synthesizeDrag's
      // coordinate-vs-shadow-DOM behavior (Lit's shadow-DOM-nested
      // doing-pane lays out the drop-target row at a slightly different
      // Y-offset from the other 5 targets, so SortableJS's lower-half
      // clientY-vs-target rect computation produces e.newIndex=0 on Lit
      // vs e.newIndex=1 on the other 5 — not a SortableList bug). The
      // engine-wrapper contract this spec gates is the bound-state sync,
      // not the SortableJS coordinate algorithm.
      const sourceHandle = todoItems.nth(0).locator(GRIP).first();
      await expect(sourceHandle).toBeVisible();
      const draggedLabel = todoBefore[0]!;

      await synthesizeDrag(page, {
        sourceHandle,
        target: doingItems.nth(0),
      });

      // Both lists must have re-rendered with new counts.
      await expect(todoItems).toHaveCount(SEED_TODO_COUNT - 1);
      await expect(doingItems).toHaveCount(SEED_DOING_COUNT + 1);

      const todoAfter = await paneLabels(todoItems);
      const doingAfter = await paneLabels(doingItems);

      // Source: dragged item gone; rest preserved in original order.
      expect(todoAfter, `todo lost the dragged item`).toEqual([
        todoBefore[1],
        todoBefore[2],
      ]);

      // Destination: contains all original items PLUS the dragged item,
      // with the original items still in their pre-drag relative order
      // (allowing the dragged item to sit anywhere among them).
      expect(doingAfter).toContain(draggedLabel);
      const doingPreservedOrder = doingAfter.filter((l) => l !== draggedLabel);
      expect(doingPreservedOrder, `doing preserved its pre-drag order`).toEqual(
        doingBefore,
      );

      // Sanity: the cross-list move conserves total items.
      expect(todoAfter.length + doingAfter.length).toBe(
        SEED_TODO_COUNT + SEED_DOING_COUNT,
      );
    },
  );
}

// ── Pointer `end`: once, after the write, from the list the row ends up in ──
// (audit E1 / E2 / B2). Driven on the behavioural Zones and Clone demos, whose
// event logs record every event as `{list}:{event}:{interaction}`.

const LOG_LI = '[class*="event-log"] li';

type Mount = ReturnType<import('@playwright/test').Page['getByTestId']>;

function texts(locator: ReturnType<import('@playwright/test').Page['locator']>) {
  return locator.evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
}

function zoneState(mount: Mount, slug: string) {
  return texts(mount.locator(`[class*="state-${slug}"] li`));
}

/** Rendered row labels of the list named `name` (its own rows only). */
function zoneRows(mount: Mount, name: string) {
  return mount.locator(`[role="list"][aria-label="${name}"]`).evaluate((list) =>
    Array.from(list.children)
      .filter((row) => (row.getAttribute('class') ?? '').includes('rozie-sortable-item'))
      .map((row) => ((row.querySelector('[class*="label"]') ?? row).textContent ?? '').trim()),
  );
}

function zoneGrip(mount: Mount, label: string) {
  return mount.getByRole('button', { name: 'Reorder ' + label, exact: true });
}

function zoneRow(mount: Mount, name: string, label: string) {
  return mount
    .locator(`[role="list"][aria-label="${name}"] > ${ITEM}`)
    .filter({ hasText: label });
}

/** Every row exists exactly once, in state and in the rendered list. */
async function expectZones(mount: Mount, want: Record<string, { name: string; labels: string[] }>) {
  for (const [slug, { name, labels }] of Object.entries(want)) {
    await expect.poll(async () => [...(await zoneState(mount, slug))].sort(), `${slug} state`).toEqual(
      [...labels].sort(),
    );
    await expect.poll(async () => [...(await zoneRows(mount, name))].sort(), `${name} rows`).toEqual(
      [...labels].sort(),
    );
  }
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  async function openZones(page: import('@playwright/test').Page) {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`/?example=SortableListZones&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(zoneGrip(mount, 'Search')).toBeVisible();
    return { mount, errors };
  }

  runner(
    `sortable-drag-cross [${target}]: end fires from the destination, once`,
    async ({ page }) => {
      const { mount, errors } = await openZones(page);
      await synthesizeDrag(page, {
        sourceHandle: zoneGrip(mount, 'Search'),
        target: zoneRow(mount, 'Bottom sidebar', 'Recent posts'),
      });
      await expectZones(mount, {
        top: { name: 'Top sidebar', labels: ['Newsletter', 'Tag cloud'] },
        bottom: { name: 'Bottom sidebar', labels: ['Recent posts', 'Search', 'Contact'] },
      });
      // Both lists wrote (`add` / `remove`) before `end`, and `end` came once,
      // from the list the row ended up in.
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['top:start:pointer', 'bottom:add:pointer', 'top:remove:pointer', 'bottom:end:pointer']);
      await page.waitForTimeout(150);
      expect((await texts(mount.locator(LOG_LI))).filter((e) => e.includes(':end:'))).toEqual([
        'bottom:end:pointer',
      ]);
      expect(errors).toEqual([]);
    },
  );

  runner(
    `sortable-drag-cross [${target}]: nested pointer drop emits one end`,
    async ({ page }) => {
      const { mount, errors } = await openZones(page);
      await synthesizeDrag(page, {
        sourceHandle: zoneGrip(mount, 'Left card'),
        target: zoneRow(mount, 'Grid column 2', 'Right card'),
      });
      await expectZones(mount, {
        grid1: { name: 'Grid column 1', labels: [] },
        grid2: { name: 'Grid column 2', labels: ['Right card', 'Left card'] },
        content: { name: 'Content', labels: ['Hero banner', 'Intro text', 'Grid', 'Gallery'] },
      });
      await page.waitForTimeout(150);
      // The grid columns' own events: one `end`, from the destination column.
      const log = await texts(mount.locator(LOG_LI));
      expect(log.filter((e) => e.startsWith('grid1:') || e.startsWith('grid2:'))).toEqual([
        'grid1:start:pointer',
        'grid2:add:pointer',
        'grid1:remove:pointer',
        'grid2:end:pointer',
      ]);
      expect(errors).toEqual([]);
    },
  );

  // KNOWN GAP on Lit (emitter behaviour, not this component): the Lit emitter
  // lowers every `$emit(name, x)` to
  // `this.dispatchEvent(new CustomEvent(name, { detail: x, bubbles: true, composed: true }))`
  // (packages/targets/lit/src/rewrite/rewriteScript.ts and
  // rewriteTemplateExpression.ts), so an inner list's events bubble out of the
  // inner host and an ancestor list's listeners on the same event name catch
  // them. The other five targets deliver `$emit` to the direct consumer only.
  // Fixing it belongs in the emitter; this stays fixme on Lit until then.
  const nestedRunner = target === 'lit' ? test.fixme : runner;
  nestedRunner(
    `sortable-drag-cross [${target}]: nested pointer drop: the outer list emits nothing`,
    async ({ page }) => {
      const { mount } = await openZones(page);
      await synthesizeDrag(page, {
        sourceHandle: zoneGrip(mount, 'Left card'),
        target: zoneRow(mount, 'Grid column 2', 'Right card'),
      });
      await expect.poll(() => zoneState(mount, 'grid2')).toContain('Left card');
      await page.waitForTimeout(150);
      const log = await texts(mount.locator(LOG_LI));
      expect(log.length).toBeGreaterThan(0);
      expect(log.filter((e) => !e.startsWith('grid1:') && !e.startsWith('grid2:'))).toEqual([]);
    },
  );

  runner(
    `sortable-drag-cross [${target}]: clone twice with re-key in end`,
    async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error' || /each_key_duplicate|duplicate key/i.test(m.text())) errors.push(m.text());
      });
      await page.goto(`/?example=SortableListClone&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();
      const palette = mount.locator('[class*="palette-pane"]').locator(ITEM);
      const canvasList = mount.locator('[class*="canvas-pane"] [role="list"]');
      const canvas = canvasList.locator(`:scope > ${ITEM}`);
      await expect(palette).toHaveCount(4);
      await expect(canvas).toHaveCount(0);
      const canvasIds = () => texts(mount.locator('[class*="state-canvas"] li'));
      const rowKeys = () =>
        canvas.evaluateAll((rows) => rows.map((r) => r.getAttribute('data-id') ?? ''));

      // A real mouse drag everywhere except Lit. KNOWN GAP on Lit (Task 6): a
      // native drop onto the EMPTY canvas list never lands. On Lit the list's
      // `#header` / `#footer` `<slot>`s (`display: contents`) are element
      // children of the list, so SortableJS's `_detectNearestEmptySortable` /
      // `lastChild` don't see it as an empty list to drop into. The
      // script-dispatched drop targets the list element directly and lands.
      const drag = target === 'lit' ? synthesizeDrag : nativeDrag;
      // First copy onto the empty canvas, then a second copy of the same
      // widget onto it.
      await drag(page, { sourceHandle: palette.nth(0).locator(GRIP).first(), target: canvasList });
      await expect(canvas).toHaveCount(1);
      await expect.poll(canvasIds).toEqual(['button-1']);
      await drag(page, { sourceHandle: palette.nth(0).locator(GRIP).first(), target: canvas.nth(0) });
      await expect(canvas).toHaveCount(2);
      await expect.poll(async () => [...(await canvasIds())].sort()).toEqual(['button-1', 'button-2']);
      await expect.poll(async () => [...(await rowKeys())].sort()).toEqual(['button-1', 'button-2']);
      await expect.poll(() => paneLabels(canvas)).toEqual(['Button', 'Button']);
      // The palette never shrinks.
      await expect(palette).toHaveCount(4);
      expect(await paneLabels(palette)).toEqual(['Button', 'Input', 'Card', 'Heading']);
      // Each drop: the canvas adds the copy, then ends the drag; the palette
      // only starts it.
      const log = await texts(mount.locator(LOG_LI));
      expect(log).toEqual([
        'palette:start:pointer',
        'canvas:add:pointer',
        'canvas:end:pointer',
        'palette:start:pointer',
        'canvas:add:pointer',
        'canvas:end:pointer',
      ]);
      expect(errors).toEqual([]);
    },
  );

  // `cloneable` lowers to `put: false`: a palette takes nothing back, by
  // pointer or by keyboard (audit B5). One copy goes onto the canvas, then the
  // canvas row is dragged onto the palette and hopped toward it.
  for (const burst of [false, true]) {
    const tag = burst ? ', back-to-back (no waits)' : '';
    runner(
      `sortable-drag-cross [${target}]: cloneable palette rejects a pointer drop and a keyboard hop${tag}`,
      async ({ page }) => {
        await page.goto(`/?example=SortableListClone&target=${target}`);
        const mount = page.getByTestId('rozie-mount');
        await expect(mount).toBeVisible();
        const paletteList = mount.locator('[class*="palette-pane"] [role="list"]');
        const palette = paletteList.locator(`:scope > ${ITEM}`);
        const canvasList = mount.locator('[class*="canvas-pane"] [role="list"]');
        const canvas = canvasList.locator(`:scope > ${ITEM}`);
        const paletteIds = () => texts(mount.locator('[class*="state-palette"] li'));
        const canvasIds = () => texts(mount.locator('[class*="state-canvas"] li'));
        const PALETTE = ['button', 'input', 'card', 'heading'];
        await expect(palette).toHaveCount(4);
        const drag = target === 'lit' ? synthesizeDrag : nativeDrag;
        await drag(page, { sourceHandle: palette.nth(0).locator(GRIP).first(), target: canvasList });
        await expect.poll(canvasIds).toEqual(['button-1']);
        await expect(canvas).toHaveCount(1);
        const logBefore = (await texts(mount.locator(LOG_LI))).length;

        // Pointer: the canvas row dropped onto the palette stays on the canvas.
        await drag(page, { sourceHandle: canvas.nth(0).locator(GRIP).first(), target: palette.nth(1) });
        await page.waitForTimeout(200);
        await expect.poll(paletteIds).toEqual(PALETTE);
        await expect.poll(() => paneLabels(palette)).toEqual(['Button', 'Input', 'Card', 'Heading']);
        await expect.poll(canvasIds).toEqual(['button-1']);
        await expect(canvas).toHaveCount(1);
        const afterPointer = (await texts(mount.locator(LOG_LI))).slice(logBefore);
        expect(afterPointer.filter((e) => e.startsWith('palette:add') || e.startsWith('canvas:remove'))).toEqual([]);

        // Keyboard: Shift+ArrowUp from the canvas finds no list before it.
        const canvasLive = mount.locator('[class*="canvas-pane"] [data-rozie-sortable-aria-live]');
        await canvas.nth(0).focus();
        if (burst) {
          for (const key of ['Space', 'Shift+ArrowUp', 'Space']) await page.keyboard.press(key);
          await expect(canvasLive).toHaveText(/^Dropped Button at position 1 of 1/);
        } else {
          await page.keyboard.press('Space');
          await expect(canvasLive).toHaveText(/^Lifted Button/);
          await page.keyboard.press('Shift+ArrowUp');
          await expect(canvasLive).toHaveText(/^No list before /);
          await page.keyboard.press('Space');
          await expect(canvasLive).toHaveText(/^Dropped Button at position 1 of 1/);
        }
        await expect.poll(paletteIds).toEqual(PALETTE);
        await expect(palette).toHaveCount(4);
        await expect.poll(canvasIds).toEqual(['button-1']);
        await expect(canvas).toHaveCount(1);
        const log = await texts(mount.locator(LOG_LI));
        expect(log.filter((e) => e.startsWith('palette:add') || e.startsWith('canvas:remove'))).toEqual([]);
      },
    );
  }
}
