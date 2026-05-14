/**
 * debounce — class-friendly handler-wrap helper for `@rozie/runtime-lit`.
 *
 * Lit port of `@rozie/runtime-vue`'s `debounce` and `@rozie/runtime-solid`'s
 * `createDebouncedHandler`. Unlike Vue/Solid — which auto-cancel a pending
 * timer through a framework cleanup hook (`onBeforeUnmount` / `onCleanup`) —
 * Lit elements have no ambient cleanup scope. The returned wrapper therefore
 * carries a `.cancel()` method so the emitted component can push it onto its
 * `_disconnectCleanups` array and clear any pending timer in
 * `disconnectedCallback`.
 *
 * The emitted Lit class assigns the wrapper to a class FIELD
 * (`private _dbnc0 = debounce(this.onSearch, 300);`) so the wrapper identity
 * is stable across `render()` calls — an inline IIFE inside `render()` would
 * reset its timer closure on every keystroke, silently defeating the debounce.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */

export interface DebouncedFn<A extends unknown[]> {
  (...args: A): void;
  /** Clear any pending invocation. Safe to call when no timer is pending. */
  cancel(): void;
}

/**
 * Return a debounced version of `fn` that delays invocation by `ms`
 * milliseconds. Calls within the delay window reset the timer.
 *
 * @param fn - The function to debounce.
 * @param ms - Delay in milliseconds.
 * @returns Debounced wrapper with a `.cancel()` method.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => unknown,
  ms: number,
): DebouncedFn<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = ((...args: A): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, ms);
  }) as DebouncedFn<A>;
  debounced.cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  return debounced;
}
