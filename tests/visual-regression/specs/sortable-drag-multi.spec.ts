import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeDrag } from '../host/dragEvent';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * sortable-drag-multi — consecutive-drag regression for SortableList.
 *
 * Companion to `sortable-drag.spec.ts`, which only drives a SINGLE drag.
 * UAT 2026-05-25 surfaced: on Lit the first drag commits cleanly (and the
 * displayed list stays synced with bound state — sortable-drag.spec.ts still
 * passes) but the SECOND drag cannot initiate at all.
 *
 * Root cause: the Lit lowering of `$reconcileAfterDomMutation()` is
 * `__rozieReconcileAfterDomMutation(this)` which calls
 * `render(nothing, host.renderRoot)`. That clears every child of the
 * shadow renderRoot — INCLUDING the `<div data-rozie-ref="__rozieRoot">`
 * that the SortableJS instance is bound to. The next render creates a
 * fresh root `<div>`; the SortableJS instance still holds a reference to
 * the orphaned old `<div>` and its pointerdown listeners are stranded
 * there. A second drag never reaches `_onTapStart` on the visible root.
 *
 * Vue/React/Svelte/Solid/Angular are unaffected because their reconcile
 * lowering is `void 0` — they don't tear down the engine's host element.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

const SEED_ITEM_COUNT = 5;
const ITEM = '[class*="rozie-sortable-item"]';
const GRIP = '[class*="grip"]';
const STATE_LI = '[class*="state-list"] li';

function displayedLabels(locator: ReturnType<import('@playwright/test').Page['locator']>) {
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
    `sortable-drag-multi [${target}]: two consecutive drags both commit`,
    async ({ page }) => {
      await page.goto(`/?example=SortableList&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();

      const items = mount.locator(ITEM);
      await expect(items).toHaveCount(SEED_ITEM_COUNT);

      const before = await displayedLabels(items);
      expect(before).toHaveLength(SEED_ITEM_COUNT);

      // ─── Drag #1: row 0 onto row 2 — insert row 0 after row 2 ────────────
      await synthesizeDrag(page, {
        sourceHandle: items.nth(0).locator(GRIP).first(),
        target: items.nth(2),
      });

      const afterFirst = await displayedLabels(items);
      expect(afterFirst, 'drag #1 must reorder the displayed list').not.toEqual(before);

      const [a0, a1, a2, ...aRest] = before;
      expect(afterFirst).toEqual([a1, a2, a0, ...aRest]);

      // ─── Drag #2: row 0 of the NEW order onto row 2 of the NEW order ─────
      // After drag #1, row order is [a1, a2, a0, a3, a4]. Drag a1 onto a3 →
      // [a2, a0, a3, a1, a4].
      await synthesizeDrag(page, {
        sourceHandle: items.nth(0).locator(GRIP).first(),
        target: items.nth(2),
      });

      const afterSecond = await displayedLabels(items);
      expect(afterSecond, 'drag #2 must reorder the displayed list').not.toEqual(
        afterFirst,
      );

      const [b0, b1, b2, ...bRest] = afterFirst;
      expect(afterSecond).toEqual([b1, b2, b0, ...bRest]);

      // Bound state must still match the displayed order after two drags.
      const stateLabels = await mount.locator(STATE_LI).evaluateAll((els) =>
        els.map((li) => {
          const label = li.querySelector('span:last-child');
          return ((label ?? li).textContent ?? '').trim();
        }),
      );
      expect(stateLabels).toEqual(afterSecond);
    },
  );
}
