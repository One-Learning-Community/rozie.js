/**
 * `debounce` — script-level handler-wrap helper for `@rozie/runtime-vue`.
 *
 * Per RESEARCH.md Code Example 4 (lines 1014-1033) + Pattern 5 (line 522-535):
 * the Vue emitter wraps a `.debounce(ms)` handler at script level
 * (`const debouncedOnSearch = debounce(onSearch, 300);`) so the wrapper has a
 * stable identity across renders.
 *
 * Auto-cancels any pending timer on Vue unmount when called inside a setup
 * context. Per RESEARCH A9 (line 1239) `onBeforeUnmount` may throw outside a
 * setup context — wrapped in try/catch defensively so the helper is also
 * usable from module scope (rare in v1 but allowed).
 *
 * @public — runtime API consumed by emitted Vue SFCs.
 */
import { onBeforeUnmount } from 'vue';

export function debounce<F extends (...args: unknown[]) => unknown>(
  fn: F,
  ms: number,
): (...args: Parameters<F>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Parameters<F>): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  try {
    onBeforeUnmount(() => {
      if (timer) clearTimeout(timer);
    });
  } catch {
    // Not in a component scope — auto-cancel becomes a no-op. Caller can
    // still cancel manually by reassigning the wrapper if needed.
  }
  return debounced;
}
