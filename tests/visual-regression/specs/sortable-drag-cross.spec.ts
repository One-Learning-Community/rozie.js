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

/**
 * Synthetic HTML5 drag of `source` onto `target` (the same events as
 * `synthesizeDrag`), but `drop` and `dragend` are dispatched in ONE in-page
 * script, so the drop target may unmount right after. `after`, when given, is
 * a key pressed on `keyEl` in that same script a few microtasks after the
 * drop (no task in between).
 */
async function scriptedDrag(
  page: import('@playwright/test').Page,
  source: ReturnType<import('@playwright/test').Page['locator']>,
  target: ReturnType<import('@playwright/test').Page['locator']>,
  keyEl: ReturnType<import('@playwright/test').Page['locator']> | null = null,
) {
  await source.evaluate((handle) => {
    const dt = new DataTransfer();
    (window as any).__dt = dt;
    const r = handle.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    handle.dispatchEvent(new PointerEvent('pointerdown', { ...o, button: 0, isPrimary: true, pointerId: 1 }));
    handle.dispatchEvent(new MouseEvent('mousedown', { ...o, button: 0 }));
    handle.dispatchEvent(new DragEvent('dragstart', { ...o, dataTransfer: dt }));
  });
  await page.waitForTimeout(60);
  for (let i = 0; i < 3; i++) {
    await target.evaluate((el, first) => {
      const r = el.getBoundingClientRect();
      const mk = (t: string) =>
        new DragEvent(t, { bubbles: true, cancelable: true, composed: true, dataTransfer: (window as any).__dt, clientX: r.left + r.width / 2, clientY: r.bottom - 3 });
      if (first) el.dispatchEvent(mk('dragenter'));
      el.dispatchEvent(mk('dragover'));
    }, i === 0);
    await page.waitForTimeout(25);
  }
  const key = keyEl ? await keyEl.elementHandle() : null;
  await target.evaluate(async (el, k) => {
    const r = el.getBoundingClientRect();
    const mk = (t: string) =>
      new DragEvent(t, { bubbles: true, cancelable: true, composed: true, dataTransfer: (window as any).__dt, clientX: r.left + r.width / 2, clientY: r.bottom - 3 });
    el.dispatchEvent(mk('drop'));
    el.dispatchEvent(mk('dragend'));
    if (k) {
      // A few microtasks: the drop's writes and its `end` hand-off run, but
      // no task does.
      for (let i = 0; i < 20; i++) await new Promise<void>((res) => queueMicrotask(res));
      (k as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true, composed: true }));
    }
  }, key);
  await page.waitForTimeout(200);
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

  // A list whose `options.group` forbids pulling (`pull: false`) keeps
  // forbidding it after its `cloneable` prop changes: `options.group` wins for
  // the mouse as for the keyboard.
  runner(
    `sortable-drag-cross [${target}]: options.group still wins after a cloneable change`,
    async ({ page }) => {
      const { mount, errors } = await openZones(page);
      await mount.getByTestId('locked-cloneable').evaluate((b) => (b as HTMLElement).click());
      await page.waitForTimeout(100);
      await synthesizeDrag(page, {
        sourceHandle: zoneGrip(mount, 'Pinned notice'),
        target: zoneRow(mount, 'Top sidebar', 'Search'),
      });
      await page.waitForTimeout(150);
      await expectZones(mount, {
        locked: { name: 'Locked', labels: ['Pinned notice'] },
        top: { name: 'Top sidebar', labels: ['Search', 'Newsletter', 'Tag cloud'] },
      });
      const log = await texts(mount.locator(LOG_LI));
      expect(log.filter((e) => e.startsWith('top:'))).toEqual([]);
      expect(errors).toEqual([]);
    },
  );

  // A row dragged in from a plain SortableJS list (not a SortableList) is not
  // accepted: it goes back where it came from (its DOM position, past the
  // foreign list's non-draggable header row), and nothing is emitted.
  runner(
    `sortable-drag-cross [${target}]: a drop from a non-SortableList list puts the row back and emits nothing`,
    async ({ page }) => {
      const { mount, errors } = await openZones(page);
      await mount.getByTestId('foreign-init').evaluate((b) => (b as HTMLElement).click());
      const foreign = mount.getByTestId('foreign').locator('li');
      await expect(foreign).toHaveCount(4);
      await synthesizeDrag(page, {
        sourceHandle: foreign.nth(1),
        target: zoneRow(mount, 'Top sidebar', 'Search'),
      });
      await page.waitForTimeout(150);
      await expect.poll(() => texts(foreign)).toEqual(['Foreign header', 'Foreign A', 'Foreign B', 'Foreign C']);
      await expectZones(mount, {
        top: { name: 'Top sidebar', labels: ['Search', 'Newsletter', 'Tag cloud'] },
      });
      expect(await texts(mount.locator(LOG_LI))).toEqual([]);
      expect(errors).toEqual([]);
    },
  );

  // The other direction is refused too (items never disappear): a row
  // dropped into a plain SortableJS list goes back where it was, nothing is
  // written, no `remove` / `reorder` is emitted, and the `end` reports the
  // drop in place (`to` is the origin, `newIndex` is `oldIndex`).
  runner(
    `sortable-drag-cross [${target}]: a drop into a non-SortableList list puts the row back; end reports it in place`,
    async ({ page }) => {
      const { mount, errors } = await openZones(page);
      await mount.getByTestId('foreign-init').evaluate((b) => (b as HTMLElement).click());
      const foreign = mount.getByTestId('foreign').locator('li');
      await expect(foreign).toHaveCount(4);
      // Both lists on screen at once: a real drag can't leave the viewport.
      await page.setViewportSize({ width: 1280, height: 4000 });
      await nativeDrag(page, { sourceHandle: zoneGrip(mount, 'Search'), target: foreign.nth(2) });
      await expect.poll(() => texts(mount.locator(LOG_LI))).toEqual(['top:start:pointer', 'top:end:pointer']);
      await page.waitForTimeout(150);
      expect(await texts(mount.locator(LOG_LI))).toEqual(['top:start:pointer', 'top:end:pointer']);
      expect(await texts(foreign)).toEqual(['Foreign header', 'Foreign A', 'Foreign B', 'Foreign C']);
      await expect.poll(() => zoneState(mount, 'top')).toEqual(['Search', 'Newsletter', 'Tag cloud']);
      await expect.poll(() => zoneRows(mount, 'Top sidebar')).toEqual(['Search', 'Newsletter', 'Tag cloud']);
      expect(JSON.parse((await mount.getByTestId('last-pointer-end-where').textContent()) || 'null')).toEqual({
        to: 'from',
        oldIndex: 0,
        newIndex: 0,
      });
      expect(errors).toEqual([]);
    },
  );

  // The destination unmounts in its own `add` handler: the unmounted list
  // never emits (Angular would log "Unexpected emit for destroyed
  // OutputRef"); the `end` comes from the origin list instead, so `start` and
  // `end` still pair, with `to` still the destination's list element.
  runner(
    `sortable-drag-cross [${target}]: the origin ends a drag whose destination unmounted in its add handler`,
    async ({ page }) => {
      const { mount, errors } = await openZones(page);
      await mount.getByTestId('top-unmount-on-add').evaluate((b) => (b as HTMLElement).click());
      await scriptedDrag(page, zoneGrip(mount, 'Recent posts'), zoneRow(mount, 'Top sidebar', 'Search'));
      await expect(mount.locator('[role="list"][aria-label="Top sidebar"]')).toHaveCount(0);
      await expect.poll(async () => [...(await zoneState(mount, 'top'))].sort()).toEqual(['Newsletter', 'Recent posts', 'Search', 'Tag cloud']);
      await expect.poll(() => zoneState(mount, 'bottom')).toEqual(['Contact']);
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['bottom:start:pointer', 'top:add:pointer', 'bottom:remove:pointer', 'bottom:end:pointer']);
      await page.waitForTimeout(300);
      expect(await texts(mount.locator(LOG_LI))).toEqual(['bottom:start:pointer', 'top:add:pointer', 'bottom:remove:pointer', 'bottom:end:pointer']);
      // The row went with the unmounted list: `el` is null, never a detached
      // element.
      expect(JSON.parse((await mount.getByTestId('last-pointer-end').textContent()) || 'null')).toEqual({
        item: 'Recent posts',
        el: null,
        interaction: 'pointer',
      });
      expect(errors).toEqual([]);
    },
  );

  // A runtime `option('group', v)` wins over `options.group` (and survives a
  // later `cloneable` change): Locked's `options.group` forbids pulling, the
  // runtime group allows it.
  runner(
    `sortable-drag-cross [${target}]: a runtime option('group') wins over options.group after a cloneable change`,
    async ({ page }) => {
      const { mount, errors } = await openZones(page);
      await mount.getByTestId('locked-runtime-group').evaluate((b) => (b as HTMLElement).click());
      await mount.getByTestId('locked-cloneable').evaluate((b) => (b as HTMLElement).click());
      await page.waitForTimeout(100);
      await synthesizeDrag(page, {
        sourceHandle: zoneGrip(mount, 'Pinned notice'),
        target: zoneRow(mount, 'Top sidebar', 'Search'),
      });
      await expectZones(mount, {
        locked: { name: 'Locked', labels: [] },
        top: { name: 'Top sidebar', labels: ['Pinned notice', 'Search', 'Newsletter', 'Tag cloud'] },
      });
      await expect
        .poll(() => texts(mount.locator(LOG_LI)))
        .toEqual(['locked:start:pointer', 'top:add:pointer', 'locked:remove:pointer', 'top:end:pointer']);
      expect(JSON.parse((await mount.getByTestId('last-pointer-end').textContent()) || 'null')).toEqual({
        item: 'Pinned notice',
        el: 'element',
        interaction: 'pointer',
      });
      expect(errors).toEqual([]);
    },
  );

  // A pending pointer `end` fires before the next `start`, even when a key
  // lifts a row before the end's task runs (scripted input: the drop and the
  // key run in one script, a few microtasks apart).
  runner(
    `sortable-drag-cross [${target}]: a pointer end comes before the next keyboard start`,
    async ({ page }) => {
      const { mount, errors } = await openZones(page);
      await scriptedDrag(page, zoneGrip(mount, 'Search'), zoneRow(mount, 'Bottom sidebar', 'Recent posts'), zoneGrip(mount, 'Contact'));
      await expect.poll(async () => (await texts(mount.locator(LOG_LI))).length).toBeGreaterThanOrEqual(5);
      const log = await texts(mount.locator(LOG_LI));
      expect(log.slice(0, 5)).toEqual([
        'top:start:pointer',
        'bottom:add:pointer',
        'top:remove:pointer',
        'bottom:end:pointer',
        'bottom:start:keyboard',
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

  // Lit too: component events stay on the element that emits them (no
  // bubbling, no shadow-root crossing), as on the other five targets.
  runner(
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

      // A real mouse drag on every target. First copy onto the empty canvas,
      // then a second copy of the same widget onto it.
      await nativeDrag(page, { sourceHandle: palette.nth(0).locator(GRIP).first(), target: canvasList });
      await expect(canvas).toHaveCount(1);
      await expect.poll(canvasIds).toEqual(['button-1']);
      await nativeDrag(page, { sourceHandle: palette.nth(0).locator(GRIP).first(), target: canvas.nth(0) });
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

  // A real mouse drag of ANY palette row lands on the empty canvas (a drop
  // into an empty list), not only of the first one.
  for (const row of [0, 1, 2, 3]) {
    runner(
      `sortable-drag-cross [${target}]: a mouse drag of palette row ${row} lands on the empty canvas`,
      async ({ page }) => {
        await page.goto(`/?example=SortableListClone&target=${target}`);
        const mount = page.getByTestId('rozie-mount');
        await expect(mount).toBeVisible();
        const palette = mount.locator('[class*="palette-pane"]').locator(ITEM);
        const canvasList = mount.locator('[class*="canvas-pane"] [role="list"]');
        const canvas = canvasList.locator(`:scope > ${ITEM}`);
        const PALETTE = ['button', 'input', 'card', 'heading'];
        await expect(palette).toHaveCount(4);
        await expect(canvas).toHaveCount(0);
        await nativeDrag(page, { sourceHandle: palette.nth(row).locator(GRIP).first(), target: canvasList });
        await expect.poll(() => texts(mount.locator('[class*="state-canvas"] li'))).toEqual([`${PALETTE[row]}-1`]);
        await expect(canvas).toHaveCount(1);
        await expect.poll(() => texts(mount.locator('[class*="state-palette"] li'))).toEqual(PALETTE);
        await expect(palette).toHaveCount(4);
        expect(await texts(mount.locator(LOG_LI))).toEqual([
          'palette:start:pointer',
          'canvas:add:pointer',
          'canvas:end:pointer',
        ]);
      },
    );
  }

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
        const drag = nativeDrag;
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
