/**
 * createThrottledHandler — returns a throttled event-handler function.
 *
 * Solid.js port of React's `useThrottledCallback`. Drops the `deps` array
 * (Solid tracks reactivity through signals, not deps). The leading-edge
 * throttle pattern: first call fires immediately; subsequent calls within
 * the `ms` window are ignored. Timer is cancelled on scope cleanup.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { onCleanup } from 'solid-js';

/**
 * Return a throttled version of `fn` that fires at most once per `ms` milliseconds.
 * Uses a leading-edge strategy: the first invocation fires immediately; subsequent
 * calls within the throttle window are dropped.
 *
 * The pending throttle window is automatically cleared when the reactive scope disposes.
 *
 * @param fn  - The function to throttle.
 * @param ms  - Throttle window in milliseconds (default `0`).
 * @returns   Throttled wrapper function with the same signature as `fn`.
 *
 * @example
 * ```tsx
 * const onScroll = createThrottledHandler((e: Event) => {
 *   setScrollY(window.scrollY);
 * }, 100);
 * ```
 */
export function createThrottledHandler<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms = 0,
): (...args: Parameters<T>) => void {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let lastCallTime = 0;

  const throttled = (...args: Parameters<T>): void => {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    if (elapsed >= ms) {
      lastCallTime = now;
      fn(...args);
    } else if (timerId === undefined) {
      // Schedule a trailing call for the remaining window.
      timerId = setTimeout(() => {
        timerId = undefined;
        lastCallTime = Date.now();
        fn(...args);
      }, ms - elapsed);
    }
  };

  onCleanup(() => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
  });

  return throttled;
}
