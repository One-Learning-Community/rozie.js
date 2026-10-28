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
 * where a per-element hook can't be called. `.once` is remembered per element
 * and listener slot, so re-attaching on a re-render does not let it fire
 * again. `forward` is the element's own ref (an author `ref="x"`, a bound
 * `:ref`, or a synthesized one), which JSX would otherwise lose, since an
 * element takes a single `ref`.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
export type RozieNativeListener<T extends Element> = readonly [
  type: string,
  handler: (event: Event & { currentTarget: T; target: T }) => void,
  options?: boolean | AddEventListenerOptions,
];

export type RozieForwardRef<T> = { current: T | null } | ((el: T | null) => void) | null | undefined;

/** Listener slots (`<index>:<type>`) whose `.once` listener already fired. */
const firedOnce = new WeakMap<Element, Set<string>>();

export function rozieNativeListeners<T extends Element>(
  listeners: ReadonlyArray<RozieNativeListener<T>>,
  forward?: RozieForwardRef<T>,
): (el: T | null) => void {
  let attached: T | null = null;
  const wrapped = listeners.map(([type, handler, options], i) => {
    const once = typeof options === 'object' && options.once === true;
    // `once` is tracked in `firedOnce` instead of passed on: the DOM's own flag
    // would reset every time the listener is re-added.
    const domOptions = typeof options === 'object' ? { ...options, once: false } : options;
    const key = `${i}:${type}`;
    const listener = (event: Event): void => {
      if (once) {
        const el = event.currentTarget as Element;
        let fired = firedOnce.get(el);
        if (fired === undefined) {
          fired = new Set();
          firedOnce.set(el, fired);
        }
        if (fired.has(key)) return;
        fired.add(key);
      }
      (handler as (event: Event) => void)(event);
    };
    return { type, listener, domOptions };
  });
  return (el: T | null): void => {
    if (attached !== null) {
      for (const { type, listener, domOptions } of wrapped) {
        attached.removeEventListener(type, listener, domOptions);
      }
    }
    attached = el;
    if (el !== null) {
      for (const { type, listener, domOptions } of wrapped) {
        el.addEventListener(type, listener, domOptions);
      }
    }
    if (typeof forward === 'function') forward(el);
    else if (forward) forward.current = el;
  };
}
