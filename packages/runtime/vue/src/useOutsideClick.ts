/**
 * `useOutsideClick` — D-42 outside-click helper for `@rozie/runtime-vue`.
 *
 * Per RESEARCH.md Code Example 3 (lines 980-1008): registers a `document`
 * click listener on mount and removes it on unmount. The optional
 * `whenSignal` getter is re-evaluated on each event so consumers can gate
 * dispatch on reactive state without recreating the listener.
 *
 * Used by the Vue target emitter when a `<listeners>` entry has a
 * `.outside(...refs)` modifier (D-40 / VUE-03 / MOD-04). The compiler
 * collapses the listener's `when:` predicate into the `whenSignal` getter
 * (D-42 collapse) so a single `useOutsideClick(...)` call replaces the
 * watchEffect-with-document-listener boilerplate that hand-rolled outside
 * detection requires today.
 *
 * `options.capture` defaults to `true` so the helper sees clicks before
 * stopPropagation() inside descendants — required for dropdown/popover
 * dismissal patterns where overlay descendants stop propagation.
 *
 * @public — runtime API consumed by emitted Vue SFCs.
 */
import { onMounted, onBeforeUnmount, type Ref } from 'vue';

export interface OutsideClickOptions {
  capture?: boolean;
}

export function useOutsideClick(
  refs: Ref<HTMLElement | undefined> | Array<Ref<HTMLElement | undefined>>,
  callback: (event: MouseEvent) => void,
  whenSignal?: () => boolean,
  options: OutsideClickOptions = {},
): void {
  const refList = Array.isArray(refs) ? refs : [refs];
  const handler = (e: MouseEvent) => {
    if (whenSignal && !whenSignal()) return;
    const target = e.target as Node;
    for (const r of refList) {
      if (r.value && r.value.contains(target)) return;
    }
    callback(e);
  };
  onMounted(() => {
    document.addEventListener('click', handler, options.capture ?? true);
  });
  onBeforeUnmount(() => {
    document.removeEventListener('click', handler, options.capture ?? true);
  });
}
