import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeDrag } from '../host/dragEvent';

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
