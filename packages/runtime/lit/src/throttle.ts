/**
 * throttle — class-friendly handler-wrap helper for `@rozie/runtime-lit`.
 *
 * Lit port of `@rozie/runtime-vue`'s `throttle` and `@rozie/runtime-solid`'s
 * `createThrottledHandler`. Leading-edge throttle: the first call in a window
 * fires immediately, subsequent calls within `ms` are dropped, and one
 * trailing call is scheduled if any calls were dropped.
 *
 * As with `debounce`, the returned wrapper carries a `.cancel()` method so the
 * emitted component can clear a pending trailing call in `disconnectedCallback`.
 * The emitter assigns it to a class FIELD for stable identity across `render()`.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */

import type { DebouncedFn } from './debounce.js';

/**
 * Return a throttled version of `fn`. Leading-edge: fires immediately, then at
 * most once per `ms` window, with a trailing call if calls were dropped.
 *
 * @param fn - The function to throttle.
 * @param ms - Window in milliseconds.
 * @returns Throttled wrapper with a `.cancel()` method.
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => unknown,
  ms: number,
): DebouncedFn<A> {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: A | undefined;
  const throttled = ((...args: A): void => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      pendingArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = undefined;
          if (pendingArgs) fn(...pendingArgs);
        }, remaining);
      }
    }
  }) as DebouncedFn<A>;
  throttled.cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    pendingArgs = undefined;
  };
  return throttled;
}
