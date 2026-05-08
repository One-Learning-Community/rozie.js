/**
 * createOutsideClick — attaches a document-level click listener that fires
 * when the click target is outside ALL provided element refs (D-136).
 *
 * Attaches synchronously on call and uses `onCleanup` so the listener is
 * automatically removed when the reactive scope disposes.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { onCleanup } from 'solid-js';

/**
 * Attach an outside-click handler that fires when the pointer event target
 * is outside every element returned by the `refs` accessors.
 *
 * Must be called inside a Solid reactive scope (component body, `createRoot`,
 * `createEffect`, etc.) so that `onCleanup` is registered correctly.
 *
 * @param refs    - Array of element accessor functions (e.g. `[() => el]`).
 * @param handler - Callback invoked with the native `MouseEvent`.
 * @param when    - Optional boolean accessor. When provided and returns `false`,
 *                  the listener is attached but events are silently ignored.
 *
 * @example
 * ```tsx
 * let panelRef!: HTMLDivElement;
 * createOutsideClick([() => panelRef], () => setOpen(false), () => open());
 * ```
 */
export function createOutsideClick(
  refs: Array<() => Element | null | undefined>,
  handler: (e: MouseEvent) => void,
  when?: () => boolean | undefined,
): void {
  const listener = (e: MouseEvent): void => {
    // Guard: if `when` is provided and returns false, do nothing.
    if (when !== undefined && !when()) return;

    const target = e.target as Node | null;
    if (target === null) return;

    // Check if target is inside any of the provided refs.
    const isInside = refs.some((refFn) => {
      const el = refFn();
      return el !== null && el !== undefined && el.contains(target);
    });

    if (!isInside) {
      handler(e);
    }
  };

  // Attach immediately — synchronous so the listener is active right away.
  document.addEventListener('click', listener, { capture: true });

  // Remove on reactive scope cleanup.
  onCleanup(() => {
    document.removeEventListener('click', listener, { capture: true });
  });
}
