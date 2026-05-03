/**
 * `useThrottledCallback` — D-65 React-side helper for the `.throttle(ms)` modifier.
 *
 * Returns a stable-identity throttled wrapper around `fn`:
 *   - **Leading edge**: first call fires immediately
 *   - **Throttle window**: subsequent calls within `ms` are suppressed
 *   - **Trailing edge**: a single trailing call fires at the window boundary
 *     with the MOST RECENT args (matches lodash leading+trailing default)
 *
 * Wrapper identity is stable (depends only on `ms`); pending trailing timer
 * cleared on unmount. `fn` is always invoked via a ref so it's never stale.
 *
 * See `useDebouncedCallback` for the `deps`-parameter rationale (kept for
 * `additionalHooks` lint scan; not used internally).
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { useCallback, useEffect, useRef, type DependencyList } from 'react';

export function useThrottledCallback<F extends (...args: never[]) => void>(
  fn: F,
  // biome-ignore lint/correctness/noUnusedFunctionParameters: see useDebouncedCallback jsdoc
  deps: DependencyList,
  ms: number,
): F {
  const fnRef = useRef(fn);
  const lastCallRef = useRef<number>(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailingArgsRef = useRef<Parameters<F> | null>(null);

  fnRef.current = fn;

  useEffect(
    () => () => {
      if (trailingTimerRef.current !== null) clearTimeout(trailingTimerRef.current);
    },
    [],
  );

  return useCallback(
    ((...args: Parameters<F>) => {
      const now = Date.now();
      const elapsed = now - lastCallRef.current;
      if (elapsed >= ms) {
        lastCallRef.current = now;
        fnRef.current(...args);
        return;
      }
      // Inside throttle window — record latest args; schedule trailing call
      // at window boundary if not already scheduled.
      trailingArgsRef.current = args;
      if (trailingTimerRef.current === null) {
        trailingTimerRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          trailingTimerRef.current = null;
          if (trailingArgsRef.current !== null) {
            const callArgs = trailingArgsRef.current;
            trailingArgsRef.current = null;
            fnRef.current(...callArgs);
          }
        }, ms - elapsed);
      }
    }) as F,
    [ms],
  );
}
