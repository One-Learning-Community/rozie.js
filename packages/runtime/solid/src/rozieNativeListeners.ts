/**
 * `rozieNativeListeners` — attach DOM listeners that carry listener options.
 *
 * A template `@event` with `.capture`, `.passive` or `.once` can't be a JSX
 * event prop: `onKeyDown={…}` takes no options, and the `on:` namespace only
 * passes them from solid-js 1.9's compiler (1.8's drops them silently). The
 * emitter lowers such listeners into the element's ref instead:
 *
 *   <div ref={(el) => { rozieNativeListeners(el, [["keydown", onKey, { capture: true, once: true }]]); }}>
 *
 * Solid runs an element's ref once, when the element is created (once per
 * element inside `<For>`), so the options go straight to `addEventListener`
 * and `.once` is the DOM's own flag. The handler is the same expression the
 * JSX prop would get; anything reactive in it is read when the event fires.
 * The listeners are removed when the owning scope is disposed.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { getOwner, onCleanup } from 'solid-js';

export type RozieNativeListener = readonly [
  type: string,
  // `never`: any typed handler (`(e: KeyboardEvent & …) => void`, `() => void`)
  // is assignable; the helper only ever calls it with the DOM event.
  handler: (event: never) => unknown,
  options?: boolean | AddEventListenerOptions,
];

export function rozieNativeListeners(
  el: Element,
  listeners: ReadonlyArray<RozieNativeListener>,
): void {
  const attached = listeners.map(([type, handler, options]) => {
    const listener = (event: Event): void => {
      (handler as (event: Event) => unknown)(event);
    };
    el.addEventListener(type, listener, options);
    return { type, listener, options };
  });
  if (getOwner() === null) return;
  onCleanup(() => {
    for (const { type, listener, options } of attached) {
      el.removeEventListener(type, listener, options);
    }
  });
}
