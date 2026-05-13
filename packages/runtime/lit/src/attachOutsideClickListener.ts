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

export function attachOutsideClickListener(
  refs: Array<() => Element | null | undefined>,
  handler: (e: MouseEvent) => void,
  when?: () => boolean,
): () => void {
  const listener = (e: MouseEvent): void => {
    // Guard: if `when` is provided and returns false, do nothing.
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
