/**
 * createDebouncedHandler — returns a debounced event-handler function.
 *
 * Solid.js port of React's `useDebouncedCallback`. Drops the `deps` array
 * (Solid tracks reactivity through signals, not deps). Timer is cancelled
 * automatically on scope cleanup via `onCleanup`.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { onCleanup } from 'solid-js';

/**
 * Return a debounced version of `fn` that delays invocation by `ms` milliseconds.
 * Subsequent calls within the delay window reset the timer.
 *
 * The pending timer is automatically cancelled when the reactive scope disposes.
 *
 * @param fn  - The function to debounce.
 * @param ms  - Delay in milliseconds (default `0`).
 * @returns   Debounced wrapper function with the same signature as `fn`.
 *
 * @example
 * ```tsx
 * const onSearch = createDebouncedHandler((e: InputEvent) => {
 *   setQuery((e.target as HTMLInputElement).value);
 * }, 300);
 * ```
 */
export function createDebouncedHandler<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms = 0,
  // NOTE: The returned function accepts extra args beyond Parameters<T> so that
  // it can safely be placed in a merged JSX event handler that passes the event
  // object — even when the original fn is () => void. Extra args are ignored.
): (...args: unknown[]) => void {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: unknown[]): void => {
    if (timerId !== undefined) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = undefined;
      fn(...(args as Parameters<T>));
    }, ms);
  };

  onCleanup(() => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
  });

  return debounced;
}
