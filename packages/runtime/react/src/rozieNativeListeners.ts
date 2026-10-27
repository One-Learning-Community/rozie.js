/**
 * `rozieNativeListeners` — attach DOM listeners to an element through its
 * callback ref, for template events whose JSX prop is a different event.
 *
 * The case that needs it: `@change` on an `<input>` / `<textarea>` means the
 * DOM `change` event (the user committed an edit), but React's JSX `onChange`
 * fires on every keystroke. The emitter lowers such listeners to
 *
 *   ref={rozieNativeListeners<HTMLInputElement>([["change", handler]], authorRef)}
 *
 * The returned callback is created on every render, so React detaches the
 * previous one (called with `null`) and attaches this one: the listener always
 * runs the current render's handler, and works for elements inside `r-for`
 * where a per-element hook can't be called. `forward` is the element's own
 * ref (an author `ref="x"` or a synthesized one), which JSX would otherwise
 * lose, since an element takes a single `ref`.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
export type RozieNativeListener<T extends Element> = readonly [
  type: string,
  handler: (event: Event & { currentTarget: T; target: T }) => void,
  options?: boolean | AddEventListenerOptions,
];

export type RozieForwardRef<T> = { current: T | null } | ((el: T | null) => void) | null | undefined;

export function rozieNativeListeners<T extends Element>(
  listeners: ReadonlyArray<RozieNativeListener<T>>,
  forward?: RozieForwardRef<T>,
): (el: T | null) => void {
  let attached: T | null = null;
  return (el: T | null): void => {
    if (attached !== null) {
      for (const [type, handler, options] of listeners) {
        attached.removeEventListener(type, handler as EventListener, options);
      }
    }
    attached = el;
    if (el !== null) {
      for (const [type, handler, options] of listeners) {
        el.addEventListener(type, handler as EventListener, options);
      }
    }
    if (typeof forward === 'function') forward(el);
    else if (forward) forward.current = el;
  };
}
