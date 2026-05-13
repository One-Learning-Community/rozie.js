/**
 * attachOutsideClickListener — Claude's Discretion consolidation of the
 * outside-click pattern for `@rozie/runtime-lit`.
 *
 * Mirror of @rozie/runtime-solid's `createOutsideClick`, with two adaptations
 * for the Lit / shadow-DOM world:
 *
 *   1. **`composedPath()` instead of `contains()`** — Lit elements live behind
 *      a shadow root, so an `e.target` for a click inside the shadow tree
 *      returns the host element (event retargeting). `e.composedPath()`
 *      enumerates the full propagation path through shadow boundaries, so a
 *      "click is inside ref?" check against `path.includes(el)` correctly
 *      handles shadow-DOM-encapsulated refs.
 *   2. **Returns an unsubscribe function** rather than registering with a
 *      reactive scope's `onCleanup`. The emitted Lit element pushes the
 *      unsubscribe into its private `_disconnectCleanups` array which is
 *      drained in `disconnectedCallback()` (D-LIT-09 + D-19 carry-forward).
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */

/**
 * Attaches a document-level outside-click listener that fires `handler` when
 * a click event falls OUTSIDE all the given `refs`.
 *
 * **`when` gate semantics (WR-01):** When `when` is provided and returns
 * `false` at event-fire time, the entire listener body is short-circuited —
 * including the inside/outside check. This means a click INSIDE a ref while
 * `when` is false is also suppressed (the handler never fires). This differs
 * from some React/Solid `useOutsideClick` implementations that gate only the
 * *outside* dispatch (not the inside check). The behaviour is intentional:
 * `when` acts as a "is the feature active?" guard on the whole listener
 * rather than a post-check filter. Consumer code that needs the asymmetric
 * behaviour should move the `when` gate inside the handler instead.
 *
 * @returns An unsubscribe function — push it into `this._disconnectCleanups`.
 */
export function attachOutsideClickListener(
  refs: Array<() => Element | null | undefined>,
  handler: (e: MouseEvent) => void,
  when?: () => boolean,
): () => void {
  const listener = (e: MouseEvent): void => {
    // Guard: if `when` is provided and returns false, do nothing.
    // NOTE: this gates the ENTIRE handler (including the inside-check).
    // See JSDoc above for the deliberate semantics.
    if (when !== undefined && !when()) return;

    // composedPath() pierces shadow boundaries — necessary because Lit
    // elements' refs typically live inside the shadow root, but the
    // document-level click listener's `e.target` retargets to the host.
    const path = e.composedPath();

    const isInside = refs.some((refFn) => {
      const el = refFn();
      return el !== null && el !== undefined && path.includes(el);
    });

    if (!isInside) {
      handler(e);
    }
  };

  // Attach synchronously — listener is active right away. Capture phase
  // matches Solid's parity (catches clicks before any per-element handler
  // calls stopPropagation).
  document.addEventListener('click', listener, { capture: true });

  // Return unsubscribe — caller pushes into host._disconnectCleanups.
  return (): void => {
    document.removeEventListener('click', listener, { capture: true });
  };
}
