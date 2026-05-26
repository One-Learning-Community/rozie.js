import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * sortable-drag-keyboard — keyboard-accessibility regression for SortableList.
 *
 * The third runtime-behavior gate for the post-v1.0 engine-wrapper slate,
 * companion to `sortable-drag.spec.ts` (single mouse-drag) and
 * `sortable-drag-multi.spec.ts` (consecutive mouse-drags). This spec exercises
 * the SortableList KEYBOARD contract end-to-end on every target cell:
 *
 *   1. focus the first row,
 *   2. press Space to LIFT the row,
 *   3. press ArrowDown twice to MOVE it two slots down,
 *   4. press Space to DROP the lift,
 *   5. assert
 *      (a) the underlying $data array order matches the post-move expectation
 *          (verified via the demo's `<ol class="state-list">` sidecar),
 *      (b) `document.activeElement` is the moved row at its NEW index — NOT
 *          `<body>` (relies on Phase 16-03 `$restoreFocus` sigil; without it,
 *          Svelte/Solid/Lit's keyed reconcilers re-create row DOM on reorder
 *          and focus drops to body),
 *      (c) the aria-live region announces the lift/move/drop transitions.
 *
 * SortableListDemo seeds 5 items via `$onMount(() => reset())`:
 *   Apple / Banana / Cherry / Date / Elderberry.
 *
 * Pressing Space on Apple lifts it; ArrowDown twice moves Apple to index 2;
 * Space drops. Expected post-move displayed order:
 *   Banana, Cherry, Apple, Date, Elderberry.
 *
 * ── CONVENTIONS (mirrors sortable-drag.spec.ts) ──────────────────────────────
 *   - 6-target loop with the `existsSync(dist/<t>/host/entry.<t>.html)`
 *     build-availability gate + `test.fixme` fallback.
 *   - STRUCTURAL assertions only — `toHaveCount` / `toEqual` / substring
 *     checks. NO screenshot matchers (per `feedback_vr_linux_baselines` —
 *     this runs on macOS without Docker baseline regen).
 *   - Substring locators (`[class*="..."]`) survive React CSS-Modules class
 *     hashing AND pierce the Lit target's shadow DOM (Playwright Locators
 *     pierce shadow roots by default).
 *   - `KNOWN_FAILING` starts as an empty `ReadonlySet<Target>` (convention
 *     preserved per Phase 16-04 PLAN; if Lit `queueMicrotask` race surfaces
 *     a flake, the cell would gate here pending the D-04 upgrade).
 *
 * ── FOCUS-IN-SHADOW-DOM PATTERN ──────────────────────────────────────────────
 * Lit emits a custom element with a shadow root; `document.activeElement` on
 * the host returns the host element, not the focused row inside. We descend
 * into `activeElement.shadowRoot.activeElement` (transitively) to find the
 * deepest active element — same shape used by other shadow-aware specs
 * (dynamic-slot-name, themed-button).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

const SEED_ITEM_COUNT = 5;
const ITEM = '[class*="rozie-sortable-item"]';
const ARIA_LIVE = '[data-rozie-sortable-aria-live]';
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
    `sortable-drag-keyboard [${target}]: Space-lift / Arrow-move / Space-drop / focus survives / aria-live announces`,
    async ({ page }) => {
      await page.goto(`/?example=SortableList&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();

      // Settle: SortableListDemo seeds 5 rows on $onMount.
      const items = mount.locator(ITEM);
      await expect(items).toHaveCount(SEED_ITEM_COUNT);

      // Capture the pre-move displayed order.
      const before = await displayedLabels(items);
      expect(before).toHaveLength(SEED_ITEM_COUNT);

      // Focus the first row. The keyboard handler lives on the row element
      // (each `[class*="rozie-sortable-item"]` carries role="listitem" +
      // tabindex="0" + @keydown after the Phase 16-04 SortableList re-land).
      await items.first().focus();

      // Space LIFTS the focused row.
      await page.keyboard.press('Space');

      // (c-lift) aria-live announces the lift.
      await expect(mount.locator(ARIA_LIVE)).toContainText(/lift/i);

      // ArrowDown twice MOVES the lifted row two slots down.
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');

      // Space DROPS the lift (committing the move).
      await page.keyboard.press('Space');

      // (c-drop) aria-live announces the drop.
      await expect(mount.locator(ARIA_LIVE)).toContainText(/drop/i);

      // (a) Displayed array order matches post-move expectation —
      // dragging row 0 down by 2 yields [b1, b2, b0, b3, b4].
      const after = await displayedLabels(items);
      expect(after).toHaveLength(SEED_ITEM_COUNT);
      const [b0, b1, b2, ...bRest] = before;
      expect(after).toEqual([b1, b2, b0, ...bRest]);

      // The bound `$data.items` (rendered by the demo's sidecar
      // <ol class="state-list">) MUST equal the displayed order — confirms
      // the keyboard handler wrote back through the model emit path.
      const stateLabels = await mount.locator(STATE_LI).evaluateAll((els) =>
        els.map((li) => {
          const label = li.querySelector('span:last-child');
          return ((label ?? li).textContent ?? '').trim();
        }),
      );
      expect(stateLabels).toEqual(after);

      // (b) Focused element is the MOVED row at its new index — not <body>.
      // Walk through shadow roots (Lit) to find the deepest active element,
      // then assert its text contains the moved label (`b0`).
      const focusedText = await page.evaluate(() => {
        let active: Element | null = document.activeElement;
        while (active && (active as HTMLElement).shadowRoot && (active as HTMLElement).shadowRoot!.activeElement) {
          active = (active as HTMLElement).shadowRoot!.activeElement;
        }
        if (!active || active.tagName === 'BODY') return '<body>';
        return (active.textContent ?? '').trim();
      });
      expect(focusedText, 'focus must survive reorder and land on the moved row').not.toBe('<body>');
      expect(focusedText).toContain(b0);
    },
  );
}
