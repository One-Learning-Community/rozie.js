/**
 * dragEvent.ts — synthetic-DragEvent helper SKELETON (Phase 13 Plan 13-01).
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
 * ── THE SEQUENCE Plan 13-05 MUST FINALIZE ────────────────────────────────────
 * One shared `DataTransfer` across the WHOLE sequence. Dispatched in order:
 *
 *   1. `dragstart`  on the SOURCE row
 *   2. `dragenter`  on the TARGET row
 *   3. `dragover`   on the TARGET row   (may need repeating — see SPIKE note)
 *   4. `drop`       on the TARGET row
 *   5. `dragend`    on the SOURCE row
 *
 * Each event:
 *   `new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer })`
 * with `clientX` / `clientY` set to the centre of the relevant element's
 * `getBoundingClientRect()`.
 *
 * SPIKE (Plan 13-05): the exact event set, the `dragover` repetition count,
 * and the `preventDefault()` calls (HTML5 DnD requires `dragover` to call
 * `preventDefault()` for `drop` to fire) are an Open-Question-1 spike — they
 * must be locked against a REAL SortableJS reorder on one target (Vue) before
 * the D-01 spec fans out to all six. The body below is a minimal first-pass
 * implementation, NOT the finished, verified helper.
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 * This helper runs IN the page. `synthesizeDragSource` is the function source
 * as a string, suitable for `page.evaluate` injection; `synthesizeDrag` is the
 * typed wrapper a spec calls with a Playwright `Page`.
 */

/** Selector pair describing one synthetic drag: drag `source` onto `target`. */
export interface SyntheticDragArgs {
  /** CSS selector for the row being dragged. */
  sourceSelector: string;
  /** CSS selector for the row it is dropped onto. */
  targetSelector: string;
}

/**
 * The in-page drag routine, as a source string for `page.evaluate`.
 *
 * SPIKE (Plan 13-05): event set + dragover repetition + preventDefault to be
 * locked against a real SortableJS reorder. This is a minimal first pass — it
 * dispatches the five-event sequence once with a shared DataTransfer, which is
 * the correct SHAPE but is not yet verified to drive an actual reorder.
 */
export const synthesizeDragInPage = (args: SyntheticDragArgs): void => {
  const { sourceSelector, targetSelector } = args;
  const source = document.querySelector<HTMLElement>(sourceSelector);
  const target = document.querySelector<HTMLElement>(targetSelector);
  if (!source || !target) {
    throw new Error(
      `synthesizeDrag: could not resolve source (${sourceSelector}) ` +
        `or target (${targetSelector})`,
    );
  }

  // One shared DataTransfer across the whole sequence — SortableJS reads/writes
  // it via setData/getData. The native synthetic dataTransfer is immutable, so
  // a constructed one is mandatory.
  const dataTransfer = new DataTransfer();

  const centre = (el: HTMLElement): { clientX: number; clientY: number } => {
    const r = el.getBoundingClientRect();
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  };

  const fire = (type: string, el: HTMLElement): void => {
    const { clientX, clientY } = centre(el);
    const ev = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX,
      clientY,
    });
    el.dispatchEvent(ev);
  };

  // SPIKE (Plan 13-05): this is the canonical five-step sequence. The spike
  // must confirm whether `dragover` needs repeating and whether explicit
  // `preventDefault()` on dragenter/dragover is required for `drop` to fire.
  fire('dragstart', source);
  fire('dragenter', target);
  fire('dragover', target);
  fire('drop', target);
  fire('dragend', source);
};

/**
 * Stringified form of {@link synthesizeDragInPage} for `page.evaluate`
 * injection. Plan 13-05 may instead pass the function reference directly to
 * `page.evaluate` — both forms are acceptable; this export documents intent.
 */
export const synthesizeDragSource = synthesizeDragInPage.toString();

/**
 * Typed wrapper a Playwright spec calls. Runs {@link synthesizeDragInPage}
 * inside the page via `page.evaluate`.
 *
 * SPIKE (Plan 13-05): the `page` parameter is typed loosely (`PageLike`) so
 * this skeleton does not yet hard-depend on `@playwright/test`'s `Page` type.
 * Plan 13-05 finalizes the signature against the real `Page`.
 */
export interface PageLike {
  evaluate<Arg>(
    fn: (arg: Arg) => void,
    arg: Arg,
  ): Promise<void>;
}

/** Drive one synthetic native-HTML5 drag in the given page. */
export async function synthesizeDrag(
  page: PageLike,
  args: SyntheticDragArgs,
): Promise<void> {
  // SPIKE (Plan 13-05): Plan 13-05 locks the event set before this is relied
  // on as a gate. Until then `sortable-drag.spec.ts` keeps its bodies fixme'd.
  await page.evaluate(synthesizeDragInPage, args);
}
