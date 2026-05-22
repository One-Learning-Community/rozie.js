/**
 * dragEvent.ts — synthetic native-HTML5-drag helper (Phase 13 Plan 13-07).
 *
 * Reusable synthetic native-HTML5-drag helper for the D-01 SortableList drag
 * regression spec (`tests/visual-regression/specs/sortable-drag.spec.ts`) and,
 * after v1.0, the engine-wrapper port slate's cross-target drag coverage.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * SortableJS uses native HTML5 drag-and-drop in Chromium (`nativeDraggable:
 * true` by default). Playwright's `mouse.down/move/up` and `locator.dragTo()`
 * emit *pointer* events — they do NOT trigger `dragstart` / `dragover` / `drop`.
 * So a Playwright-mouse "drag" never reorders a SortableJS list, and a spec
 * built on it asserts trivially-true (RESEARCH Pitfall 6). The fix is to
 * dispatch synthetic `DragEvent`s, in-page, with a single shared
 * `DataTransfer` object (browsers forbid mutating the native synthetic
 * `dataTransfer`, so a constructed one is required; SortableJS calls
 * `setData` / `getData` on it across the sequence).
 *
 * ── THE SEQUENCE (locked against a real SortableJS reorder, Plan 13-07) ──────
 * The exact event set below was spiked against the Vue `sortable-drag` cell
 * until it drove a genuine SortableJS reorder, then fanned out and confirmed
 * on React / Svelte / Solid / Angular. One shared `DataTransfer` across the
 * WHOLE sequence. Dispatched in order:
 *
 *   1. `pointerdown` + `mousedown` on the SOURCE row's drag HANDLE.
 *        SortableJS v1.15 runs with `supportPointer: true`, so it binds
 *        `pointerdown` (NOT `mousedown`) for `_onTapStart`. `_onTapStart`
 *        enforces `options.handle` — the down event MUST originate on (or
 *        inside) the `.grip` handle element, not the row itself, or
 *        `_prepareDragStart` is never reached and the drag silently no-ops.
 *        `mousedown` is dispatched too for belt-and-braces across engine
 *        configs that flip `supportPointer` off.
 *   2. `dragstart` on the SOURCE handle. `_onTapStart` → `_prepareDragStart`
 *        binds `dragstart` on the list synchronously during the down event,
 *        so the `dragstart` dispatch must follow in the same in-page call.
 *   3. (caller waits one macrotask — SortableJS defers `_dragStarted` via
 *        `setTimeout(fn, 0)`, which binds the `document` `dragover` listener.)
 *   4. `dragenter` then `dragover` (×3) on the TARGET row, with `clientY` in
 *        the LOWER half of the target's `getBoundingClientRect()` so
 *        SortableJS inserts the dragged row AFTER the target. Repeating
 *        `dragover` lets SortableJS cross its reorder threshold reliably.
 *   5. `drop` on the TARGET row — commits the move; SortableJS fires
 *        `onUpdate`, which is where `SortableList.rozie` writes the reordered
 *        array back through the two-way `r-model:items` binding.
 *   6. `dragend` on the TARGET row (NOT `document`): inside a shadow tree
 *        (the Lit target) a `document`-targeted `dragend` never reaches
 *        SortableJS's shadow-bound listener; a `composed: true` event
 *        dispatched on an in-tree node retargets out to `document` correctly.
 *
 * Each event is `new DragEvent(type, { bubbles, cancelable, composed,
 * dataTransfer, clientX, clientY })`. `composed: true` is mandatory — the Lit
 * target mounts the SortableJS list two shadow roots deep, and only composed
 * events cross shadow boundaries.
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 * The helper is driven through Playwright `Locator`s rather than raw
 * `document.querySelector`, because the Lit target nests the list in shadow
 * DOM (Playwright locators pierce shadow roots; `document.querySelector` in a
 * bare `page.evaluate` does not) and the React target CSS-Modules-hashes class
 * names (so callers pass substring `[class*="..."]` locators). `synthesizeDrag`
 * takes the source-handle and target Playwright locators and runs the whole
 * sequence, including the inter-step macrotask waits.
 */

import type { Locator, Page } from '@playwright/test';

/** Locators describing one synthetic drag: drag `sourceHandle`'s row onto `target`. */
export interface SyntheticDragArgs {
  /** Playwright locator for the drag handle inside the row being dragged. */
  sourceHandle: Locator;
  /** Playwright locator for the row the dragged row is dropped onto. */
  target: Locator;
}

/**
 * Fire `pointerdown` + `mousedown` + `dragstart` on the source drag handle.
 * Runs in-page; stashes the shared `DataTransfer` on `window` for the rest of
 * the sequence to reuse.
 */
function pressAndStart(handle: HTMLElement): void {
  const dt = new DataTransfer();
  (window as unknown as { __rozieDragDT?: DataTransfer }).__rozieDragDT = dt;
  const r = handle.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      button: 0,
      isPrimary: true,
      pointerId: 1,
    }),
  );
  handle.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      button: 0,
    }),
  );
  handle.dispatchEvent(
    new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      composed: true,
      dataTransfer: dt,
      clientX: x,
      clientY: y,
    }),
  );
}

/**
 * Fire one `DragEvent` of `opts.type` on the target row, with `clientY` pinned
 * to the lower half of the target's rect. When `opts.withEnter` is set, a
 * `dragenter` is dispatched first.
 *
 * `Locator.evaluate` marshals exactly one `arg`, so the parameters travel as a
 * single object literal rather than a positional list.
 */
function fireDragEventLowerHalf(
  target: HTMLElement,
  opts: { type: string; withEnter: boolean },
): void {
  const dt = (window as unknown as { __rozieDragDT?: DataTransfer }).__rozieDragDT;
  // The shared DataTransfer is stashed by `pressAndStart`; if it is missing the
  // sequence was driven out of order — fail loud rather than dispatch a
  // dataTransfer-less DragEvent SortableJS would silently ignore.
  if (!dt) {
    throw new Error(
      'synthesizeDrag: shared DataTransfer missing — dragstart must run first',
    );
  }
  const r = target.getBoundingClientRect();
  const x = r.left + r.width / 2;
  // Lower half → SortableJS inserts the dragged row AFTER the target.
  const y = r.bottom - 3;
  const mk = (t: string): DragEvent =>
    new DragEvent(t, {
      bubbles: true,
      cancelable: true,
      composed: true,
      dataTransfer: dt,
      clientX: x,
      clientY: y,
    });
  if (opts.withEnter) target.dispatchEvent(mk('dragenter'));
  target.dispatchEvent(mk(opts.type));
}

/**
 * Drive one synthetic native-HTML5 drag — drag the row owning `sourceHandle`
 * onto `target` (inserting it AFTER `target`), via a real SortableJS reorder.
 *
 * The inter-step macrotask waits matter: SortableJS defers `_dragStarted` (and
 * the `document` `dragover` binding it installs) by `setTimeout(fn, 0)`, so the
 * `dragover` burst must follow the `dragstart` after at least one macrotask.
 */
export async function synthesizeDrag(
  page: Page,
  args: SyntheticDragArgs,
): Promise<void> {
  const { sourceHandle, target } = args;

  // 1+2. pointerdown / mousedown / dragstart on the source handle.
  await sourceHandle.evaluate(pressAndStart);

  // 3. Let SortableJS's deferred `_dragStarted` (setTimeout 0) run.
  await page.waitForTimeout(60);

  // 4. dragenter + dragover burst on the target's lower half.
  for (let i = 0; i < 3; i++) {
    await target.evaluate(fireDragEventLowerHalf, {
      type: 'dragover',
      withEnter: i === 0,
    });
    await page.waitForTimeout(25);
  }

  // 5+6. drop then dragend, both on the target row (composed events retarget
  // out of shadow DOM; a `document`-targeted dragend would miss the Lit cell's
  // shadow-bound SortableJS listener).
  await target.evaluate(fireDragEventLowerHalf, { type: 'drop', withEnter: false });
  await target.evaluate(fireDragEventLowerHalf, { type: 'dragend', withEnter: false });

  // Let the target framework flush the reorder back through `r-model:items`.
  await page.waitForTimeout(200);
}
