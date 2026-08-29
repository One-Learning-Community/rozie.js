/**
 * computeEscapingNames — quick 260829-j18 Task 2.
 *
 * Single computation of the "escaping" top-level binding name set: every
 * identifier referenced as a `closure`-scoped `SignalRef` from an
 * `ir.listeners[].deps` or `ir.lifecycle[].setupDeps` entry.
 *
 * Before this quick, `emitScript.ts` built this exact set TWICE —
 * independently, in two different places (section 6a's `escapingHelperNames`
 * construction, and a byte-identical local `escaping` loop inside the
 * `useCallbackHelperNames` computation). Both consumers now read this one
 * computation so the `useMemo`/`useCallback` wrap decision and the
 * quick-260803-w7b seam-3 staleness classification can never silently
 * diverge.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '@rozie/core';

export function computeEscapingNames(ir: IRComponent): Set<string> {
  const names = new Set<string>();
  for (const listener of ir.listeners) {
    for (const dep of listener.deps) {
      if (dep.scope === 'closure') names.add(dep.identifier);
    }
  }
  for (const lh of ir.lifecycle) {
    for (const dep of lh.setupDeps) {
      if (dep.scope === 'closure') names.add(dep.identifier);
    }
  }
  return names;
}
