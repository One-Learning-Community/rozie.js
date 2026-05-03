/**
 * `useDebouncedCallback` — D-65 React-side helper for the `.debounce(ms)` modifier.
 *
 * Returns a stable-identity debounced wrapper around `fn`. Subsequent calls
 * within `ms` reset the timer; the wrapped fn fires once at the boundary with
 * the LAST args. Pending timer is cleared on unmount.
 *
 * **Stable identity**: the wrapper has the same `===` identity across every
 * render (only depends on `ms`). Consumers can safely include it in
 * `useEffect` dep arrays without re-firing the effect on every render.
 *
 * **Always-fresh fn closure**: `fn` is stored in a ref that updates every
 * render. The wrapper reads `fnRef.current` at fire time so it always invokes
 * the LATEST closure — no stale captures.
 *
 * **`deps` parameter**: kept in the public API so the
 * `additionalHooks: '(useDebouncedCallback|...)'` ESLint regex can scan the
 * second arg for exhaustive-deps validation at the call-site (consumers
 * spread `Listener.deps` from `ReactiveDepGraph` here per D-21 / D-61).
 * Internally the parameter is currently unused — the render-time-ref-update
 * pattern keeps `fn` fresh without needing `deps` to invalidate anything. The
 * arg is retained to satisfy the lint rule and to leave room for future
 * implementations that genuinely care about deps (e.g., switching back to a
 * `useEffect`-driven ref update).
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { useCallback, useEffect, useRef, type DependencyList } from 'react';

export function useDebouncedCallback<F extends (...args: never[]) => void>(
  fn: F,
  // biome-ignore lint/correctness/noUnusedFunctionParameters: see jsdoc — kept for additionalHooks lint scan
  deps: DependencyList,
  ms: number,
): F {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update ref on every render — React permits ref mutation during render
  // for "track latest value" patterns. No effect needed.
  fnRef.current = fn;

  // Cleanup any pending timer on unmount.
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(
    ((...args: Parameters<F>) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, ms);
    }) as F,
    [ms],
  );
}
