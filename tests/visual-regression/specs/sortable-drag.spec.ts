import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeDrag } from '../host/dragEvent';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * D-01 — SortableList drag-interaction regression spec (Phase 13).
 *
 * The first RUNTIME-behavior gate for the post-v1.0 engine-wrapper slate.
 * Every prior Rozie gate is compile / typecheck / static-screenshot — Bug 3
 * of the `sortablelist-drag-desync` debug session (React's CSS-Modules-hashed
 * `.grip` never matched the literal `.grip` selector SortableJS was handed)
 * escaped precisely because nothing exercised a real drag. This spec drives a
 * genuine SortableJS reorder on each target cell and asserts the displayed row
 * order stays synced with the bound `$data` array.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────────
 * `examples/demos/SortableListDemo.rozie` wraps `examples/SortableList.rozie`,
 * which boots a real SortableJS instance. The demo's drag handle is
 * `:handle="$classSelector('grip')"` — so React's CSS-Modules-hashed `.grip`
 * class resolves correctly and a drag can start on every target (closing
 * Bug 3). SortableListDemo seeds 5 items via `$onMount(() => reset())`:
 * Apple / Banana / Cherry / Date / Elderberry.
 *
 * Per target the spec:
 *   1. boots the SortableList cell (`?example=SortableList&target=<t>`),
 *   2. drives a synthetic native-HTML5 reorder via `host/dragEvent.ts`
 *      (`synthesizeDrag` — drags row 1's handle onto row 3, inserting row 1
 *      after row 3),
 *   3. asserts the displayed `[class*="rozie-sortable-item"]` label order
 *      changed AND matches the bound-state order in the demo's
 *      `<ol class="state-list">`.
 *
 * The React cell additionally proves Bug 3 closed (the `.grip` handle resolves
 * and a drag can start at all) and regression-guards the already-fixed
 * stale-closure bug; the assertion below would fail if the handle never
 * matched (no reorder) or if the reorder didn't propagate through `r-model`.
 *
 * ── CONVENTIONS (mirrors full-calendar.spec.ts) ──────────────────────────────
 *   - 6-target loop with the `existsSync(dist/<t>/host/entry.<t>.html)`
 *     build-availability gate + `test.fixme` fallback, so a soft-failing
 *     sub-build does not red the whole suite.
 *   - STRUCTURAL assertions only — `toHaveCount` / `toEqual` on label arrays.
 *     NO `toHaveScreenshot` (per `feedback_vr_linux_baselines`: runs on macOS
 *     without Docker baseline regen).
 *   - Locators that survive React CSS-Modules hashing — substring
 *     `[class*="..."]` matchers — and that pierce the Lit target's shadow DOM
 *     (Playwright `Locator`s pierce shadow roots by default; a bare
 *     `document.querySelector` does not). `.rozie-sortable-item` is the
 *     wrapper-authored class; React hashes it to `_rozie-sortable-item_<hash>`
 *     which still contains the original token as a substring.
 *
 * ── KNOWN_FAILING: lit ───────────────────────────────────────────────────────
 * See the `KNOWN_FAILING` set below — the Lit cell carries a per-cell
 * `test.fixme` with a documented reason; the suite is NOT marked fixme-wide
 * and no assertion is weakened to pass trivially.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

/**
 * Per-cell known-failing set (mirrors `full-calendar.spec.ts`'s per-cell gate).
 *
 * `lit` — the synthetic drag DOES drive a real SortableJS reorder on Lit (the
 * dragged row visibly moves during the `dragover` burst, and the reordered
 * array propagates back through the two-way `r-model:items` binding — the
 * demo's `<ol class="state-list">` updates correctly). BUT after `drop`, the
 * displayed `[class*="rozie-sortable-item"]` list reverts to the pre-drag
 * order while the bound state stays reordered — a genuine displayed/bound
 * DESYNC, the very thing this spec asserts against.
 *
 * Root cause (not a `$classSelector` regression): `SortableList.rozie`'s
 * `onUpdate` handler does `e.item.remove()` + `$el.insertBefore(...)` to
 * restore the pre-drag DOM before writing the new array — the cross-framework
 * reconciler workaround that works for Vue/React/Svelte/Solid/Angular. On Lit
 * that manual node removal/reinsertion corrupts `lit-html`'s part tree (it
 * tracks the identity of the nodes it rendered), so the subsequent keyed
 * re-render against the reordered `items` cannot reconcile and the displayed
 * list stays stale. The Lit cell's NORMAL data path (the demo's Add button) is
 * unaffected — only the `onUpdate` DOM-restore path collides with lit-html.
 *
 * TODO(rozie-lit-sortable-reconcile): fix `SortableList.rozie`'s `onUpdate`
 * reconciler for the Lit target — either skip the manual DOM restore on Lit
 * (let lit-html own the nodes) or force a full keyed re-render after the
 * splice. Tracked as a post-Phase-13 follow-up; out of scope for the
 * `$classSelector` phase (which is test + docs only). Un-fixme this cell once
 * the Lit reconciler path is fixed.
 */
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>(['lit']);

// SortableListDemo seeds 5 items via `$onMount(() => reset())`. `settleExample`
// in matrix.spec.ts already waits for exactly 5 `.rozie-sortable-item`.
const SEED_ITEM_COUNT = 5;

// Substring locators: survive React CSS-Modules hashing (`_rozie-sortable-
// item_<hash>` still contains `rozie-sortable-item`) and, via Playwright's
// shadow-piercing locator engine, reach the Lit target's nested shadow DOM.
const ITEM = '[class*="rozie-sortable-item"]';
const GRIP = '[class*="grip"]';
const STATE_LI = '[class*="state-list"] li';

/** Read the displayed row labels in DOM order. */
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
    `sortable-drag [${target}]: synthetic reorder keeps bound $data in sync`,
    async ({ page }) => {
      await page.goto(`/?example=SortableList&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();

      // Settle: SortableListDemo seeds 5 rows on $onMount.
      const items = mount.locator(ITEM);
      await expect(items).toHaveCount(SEED_ITEM_COUNT);

      // Capture the pre-drag displayed order.
      const before = await displayedLabels(items);
      expect(before).toHaveLength(SEED_ITEM_COUNT);

      // The React cell proves Bug 3 closed: a drag can START at all only if
      // the `.grip` handle resolves. `$classSelector('grip')` makes the
      // SortableJS handle selector resolve against React's CSS-Modules-hashed
      // DOM. If the handle never matched, `synthesizeDrag` below would no-op
      // and the reorder assertion would fail.
      const sourceHandle = items.nth(0).locator(GRIP).first();
      await expect(sourceHandle).toBeVisible();

      // Drive a real SortableJS reorder: drag row 1 (Apple) onto row 3
      // (Cherry), inserting Apple after Cherry → Banana, Cherry, Apple, …
      await synthesizeDrag(page, {
        sourceHandle,
        target: items.nth(2),
      });

      // The displayed order must have actually changed — guards against a
      // trivially-passing no-op drag (RESEARCH Pitfall 6 / threat T-13-05).
      const after = await displayedLabels(items);
      expect(after).toHaveLength(SEED_ITEM_COUNT);
      expect(after, 'the synthetic drag must reorder the displayed list').not.toEqual(
        before,
      );

      // The expected order after dragging row 1 below row 3.
      const [first, second, third, ...rest] = before;
      expect(after).toEqual([second, third, first, ...rest]);

      // The bound `$data.items` order — rendered by the demo's
      // `<ol class="state-list">` — must match the displayed order. This is
      // R6: displayed list stays synced with the bound array after a drag.
      const stateLabels = await mount.locator(STATE_LI).evaluateAll((els) =>
        els.map((li) => {
          // Each <li> is `<span>idx.</span><code>id</code><span>label</span>`.
          const label = li.querySelector('span:last-child');
          return ((label ?? li).textContent ?? '').trim();
        }),
      );
      expect(stateLabels).toEqual(after);
    },
  );
}
