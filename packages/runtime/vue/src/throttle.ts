/**
 * `throttle` — script-level handler-wrap helper for `@rozie/runtime-vue`.
 *
 * Fires immediately on the first call, then suppresses invocations within
 * the `ms` throttle window. A trailing call is scheduled when invocations
 * occur during the suppressed window — matches lodash's leading+trailing
 * default which is what `Dropdown.rozie`'s
 * `@resize.throttle(100).passive` pattern relies on (the dropdown's panel
 * stays positioned during continuous resize, then snaps to the final
 * position one tick after resize ends).
 *
 * Auto-cancels pending trailing call on Vue unmount when called inside
 * setup; A9 try/catch defensive (parallel to debounce).
 *
 * @public — runtime API consumed by emitted Vue SFCs.
 */
import { onBeforeUnmount } from 'vue';

export function throttle<F extends (...args: unknown[]) => unknown>(
  fn: F,
  ms: number,
): (...args: Parameters<F>) => void {
  let last = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  // Latest args captured during the suppressed window — the trailing call
  // fires with the MOST RECENT args (lodash's leading+trailing default).
  let pendingArgs: Parameters<F> | undefined;
  const throttled = (...args: Parameters<F>): void => {
    const now = Date.now();
    const elapsed = now - last;
    if (elapsed >= ms) {
      last = now;
      fn(...args);
      return;
    }
    // Inside the suppressed window — record latest args. If no trailing
    // timer is queued yet, schedule one for window-end.
    pendingArgs = args;
    if (!pendingTimer) {
      pendingTimer = setTimeout(() => {
        last = Date.now();
        pendingTimer = undefined;
        const callArgs = pendingArgs as Parameters<F>;
        pendingArgs = undefined;
        fn(...callArgs);
      }, ms - elapsed);
    }
  };
  try {
    onBeforeUnmount(() => {
      if (pendingTimer) clearTimeout(pendingTimer);
    });
  } catch {
    // Not in a component scope — auto-cancel becomes a no-op.
  }
  return throttled;
}
