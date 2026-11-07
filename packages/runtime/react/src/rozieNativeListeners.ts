/**
 * `rozieNativeListeners` — attach DOM listeners to an element through its
 * callback ref, for template events JSX can't express as a prop.
 *
 * Two cases need it:
 *   - `@change` on an `<input>` / `<textarea>` means the DOM `change` event
 *     (the user committed an edit), but React's JSX `onChange` fires on every
 *     keystroke.
 *   - a listener carrying `.passive` or `.once` (with or without `.capture`):
 *     JSX props take no listener options (`.capture` alone maps to the
 *     `on<Event>Capture` prop and stays on JSX).
 *
 * The emitter lowers such listeners to
 *
 *   ref={rozieNativeListeners<HTMLDivElement, ["keydown"]>([["keydown", handler, { once: true }]], authorRef)}
 *
 * The second type argument lists the event names in order, so each handler's
 * event is typed from `HTMLElementEventMap` (`KeyboardEvent` for `keydown`;
 * plain `Event` for a name the map doesn't know). Omitted, every handler gets
 * `Event`, which is the shape older compiled output relies on.
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

/** The event a listener for `type` receives on an element of type `T`. */
export type RozieNativeEvent<T extends Element, K extends string = string> = (K extends keyof HTMLElementEventMap
  ? HTMLElementEventMap[K]
  : Event) & { currentTarget: T; target: T };

export type RozieNativeListener<T extends Element, K extends string = string> = readonly [
  type: K,
  handler: (event: RozieNativeEvent<T, K>) => void,
  options?: boolean | AddEventListenerOptions,
];

/** One `RozieNativeListener` per event name in `Ks`, in order. */
export type RozieNativeListeners<T extends Element, Ks extends readonly string[]> = {
  readonly [I in keyof Ks]: RozieNativeListener<T, Ks[I]>;
};

export type RozieForwardRef<T> = { current: T | null } | ((el: T | null) => void) | null | undefined;

/** Listener slots (`<index>:<type>`) whose `.once` listener already fired. */
const firedOnce = new WeakMap<Element, Set<string>>();

export function rozieNativeListeners<
  T extends Element,
  Ks extends readonly string[] = readonly string[],
>(listeners: RozieNativeListeners<T, Ks>, forward?: RozieForwardRef<T>): (el: T | null) => void {
  let attached: T | null = null;
  const entries = listeners as unknown as ReadonlyArray<RozieNativeListener<T>>;
  const wrapped = entries.map(([type, handler, options], i) => {
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
