import { test, expect, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeDrag } from '../host/dragEvent';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * SortableList keying behavioral spec (quick 260620-o6a).
 *
 * Proves the id-less-object-list data-corruption fix BEHAVIORALLY — a static
 * screenshot cannot catch instance/state corruption.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * id-less object items (sections / closure blocks with no `id` field) previously
 * fell to `item ?? index` keying. On reorder the framework reconciler rebinds row
 * component instances BY POSITION, so `$onMount`-seeded local state (and the
 * `:data-id`) gets written back to the WRONG item. SortableList 0.1.3 fixes this
 * with a 4-tier keyFor: a function `itemKey`, then a string `itemKey`, then an
 * instance-scoped WeakMap synthetic id (keyed by object identity → survives
 * reorder), then index.
 *
 * `examples/demos/SortableListKeyingDemo.rozie` mounts TWO SortableLists of
 * id-less objects (Alpha/Bravo/Charlie/Delta/Echo): one with NO itemKey (the
 * WeakMap default, KEY-02) and one with a FUNCTION itemKey (a WeakMap-backed
 * extractor, KEY-01 — the consumer's literal ask). Each row renders a
 * `KeyMarkerRow` that stamps a DISTINCT mount-time marker (from a shared module
 * counter, examples/demos/keyMarkerCounter.js) exactly once in `$onMount`. The
 * marker therefore travels with the component INSTANCE.
 *
 * ── WHAT IT ASSERTS ──────────────────────────────────────────────────────────
 * After a synthetic drag of row 0 onto row 2, per section:
 *   (a) the displayed label order changed (guards a no-op drag), and
 *   (b) the (label → mark) PAIR SET is unchanged — each row's mount marker
 *       stayed bound to its ORIGINAL item.
 * Under the old position-keying bug the labels move but the marks stay at their
 * slots, scrambling the pairs and failing (b). A distinct-markers precondition
 * guards against a vacuous pass (a per-instance counter would mark every row `#0`
 * → the pair set would be invariant even under the bug).
 *
 * ── TARGETS ──────────────────────────────────────────────────────────────────
 * vue + react — the keyFor/`:key`-keyed reconcilers, where the fix is load-
 * bearing. Solid's `<For>` keys by element REFERENCE and ignores `:key`, so an
 * id-less same-ref reorder is inherently stable on Solid regardless of keyFor;
 * the cell still BUILDS for all six.
 *
 * ── CONVENTIONS (mirrors sortable-drag.spec.ts / flatpickr-behavior.spec.ts) ──
 *   - existsSync build-availability gate + test.fixme fallback.
 *   - STRUCTURAL assertions only — NO toHaveScreenshot (runs on macOS without
 *     Docker baseline regen; feedback_vr_linux_baselines).
 *   - Substring `[class*="..."]` locators survive React CSS-Modules hashing and
 *     pierce the Lit target's shadow DOM.
 */

const TARGETS = ['vue', 'react'] as const;
type Target = (typeof TARGETS)[number];

const SECTIONS = ['keying-default', 'keying-fn'] as const;

const SEED_ITEM_COUNT = 5;

const ITEM = '[class*="rozie-sortable-item"]';
const ROW = '[class*="km-row"]';
const MARK = '[class*="km-mark"]';
const GRIP = '[class*="grip"]';

interface RowPair {
  label: string;
  mark: string;
}

/** Read each row's { label, mark } in DOM order within a section. */
function readRows(section: Locator): Promise<RowPair[]> {
  return section.locator(ROW).evaluateAll((els) =>
    els.map((el) => ({
      label: (el.querySelector('[class*="km-label"]')?.textContent ?? '').trim(),
      mark: (el.querySelector('[class*="km-mark"]')?.textContent ?? '').trim(),
    })),
  );
}

/** The set of `label=mark` pairs (order-independent). */
function pairSet(rows: RowPair[]): Set<string> {
  return new Set(rows.map((r) => `${r.label}=${r.mark}`));
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;

  runner(
    `sortable-keying [${target}]: id-less object reorder keeps mount markers bound to their item`,
    async ({ page }) => {
      await page.goto(`/?example=SortableListKeying&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();

      for (const sectionId of SECTIONS) {
        const section = mount.locator(`[data-testid="${sectionId}"]`);
        const items = section.locator(ITEM);
        await expect(items).toHaveCount(SEED_ITEM_COUNT);

        // Wait until every mount marker is populated AND distinct — the
        // non-vacuous precondition. A per-instance counter (the wrong fixture
        // design) would stamp every row `#0`, so the pair-set test would pass
        // even under the position-keying bug; distinct markers rule that out.
        await expect
          .poll(async () => {
            const marks = await section
              .locator(MARK)
              .evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
            const populated = marks.length === SEED_ITEM_COUNT && marks.every((m) => /#\d/.test(m));
            return populated && new Set(marks).size === SEED_ITEM_COUNT;
          })
          .toBe(true);

        const before = await readRows(section);
        expect(before).toHaveLength(SEED_ITEM_COUNT);
        const beforeLabels = before.map((r) => r.label);

        // Drag row 0 onto row 2 (Alpha moves below Charlie).
        const sourceHandle = items.nth(0).locator(GRIP).first();
        await expect(sourceHandle).toBeVisible();
        await synthesizeDrag(page, { sourceHandle, target: items.nth(2) });

        const after = await readRows(section);
        expect(after).toHaveLength(SEED_ITEM_COUNT);
        const afterLabels = after.map((r) => r.label);

        // (a) the displayed order actually changed — guards a no-op drag.
        expect(
          afterLabels,
          `the synthetic drag must reorder the displayed list (${sectionId})`,
        ).not.toEqual(beforeLabels);

        // (b) the (label → mark) pair set is invariant: each row's mount marker
        // stayed bound to its ORIGINAL item. Position-keying scrambles this.
        expect(
          pairSet(after),
          `(label→mark) pairs must be invariant across the reorder (${sectionId})`,
        ).toEqual(pairSet(before));
      }
    },
  );
}
