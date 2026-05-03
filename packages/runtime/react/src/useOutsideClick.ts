/**
 * `useOutsideClick` — D-65 listenerOnly helper for the `.outside(...)` modifier.
 *
 * Attaches a single document-level capture-phase `click` listener that fires
 * `callback` ONLY when the event target is OUTSIDE every provided ref's element.
 * Per MOD-04: with refs `[a, b, c]`, click outside ALL three → fire; click
 * inside ANY one → don't fire.
 *
 * **Stale-closure defense (D-61)**: callback and the optional `when` predicate
 * are stored in refs that update on every render. The internal effect uses an
 * empty-dep-array (well, just `[refs]`) so the document listener is attached
 * exactly once for the component's lifetime; the handler reads the LATEST
 * callback / when via the ref indirection. This is the success-criterion-1
 * anchor for Plan 04-04 — the dropdown stale-closure integration test
 * verifies this end-to-end.
 *
 * **Capture phase**: we listen at capture so we see clicks before any
 * descendant calls `event.stopPropagation()`. Required for dropdown / popover
 * dismissal patterns where overlay descendants stop propagation but the
 * dropdown still needs to know about the click.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { useEffect, useRef, type RefObject } from 'react';

export function useOutsideClick(
  refs: ReadonlyArray<RefObject<Element | null>>,
  callback: (e: MouseEvent) => void,
  when?: () => boolean,
): void {
  // Latest-callback / latest-when refs — written every render so the handler's
  // closure always sees the freshest values without re-attaching the listener.
  const callbackRef = useRef(callback);
  const whenRef = useRef(when);
  callbackRef.current = callback;
  whenRef.current = when;

  // Refs[] identity may change across renders; we want a stable iteration target
  // inside the effect without violating exhaustive-deps. Snapshot into a ref
  // and update it every render — same pattern as callback/when.
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const w = whenRef.current;
      if (w && !w()) return;
      const target = e.target as Node | null;
      if (!target) return;
      for (const r of refsRef.current) {
        if (r.current && r.current.contains(target)) return;
      }
      callbackRef.current(e);
    };
    document.addEventListener('click', handler, true);
    return () => {
      document.removeEventListener('click', handler, true);
    };
  }, []);
}
