/**
 * emitListenerOutsideClick — Lit `.outside(...)` modifier emission (Plan 06.4-02 Task 1).
 *
 * Emits a call to `attachOutsideClickListener(refs, handler, when)` from
 * `@rozie/runtime-lit`. The runtime helper uses `e.composedPath()` to
 * correctly handle shadow-DOM-encapsulated refs. Returned unsubscribe is
 * pushed to `this._disconnectCleanups`.
 *
 * NOTE (WR-05): This module is NOT currently called by the emitListeners.ts
 * orchestrator — the orchestrator inlines equivalent logic directly. This
 * standalone helper exists for unit-testing and future Phase 7 unification.
 * TODO(Phase 7): refactor emitListeners.ts to call emitListenerOutsideClick here.
 *
 * @experimental — shape may change before v1.0
 */
import type { RuntimeLitImportCollector } from '../rewrite/collectLitImports.js';

export interface EmitListenerOutsideClickOpts {
  /** Names of refs (without `_ref` prefix) the click must be outside of. */
  refNames: string[];
  /** Rewritten handler expression (e.g., `(this.close)` or `(e) => this.close()`). */
  handler: string;
  /** Optional when-guard expression (string form). */
  whenExpr: string | null;
  /** Inline filter guards (e.g., `e.stopPropagation();`). */
  guards: string[];
  /** Index for unique variable naming. */
  index: number;
  /** Runtime collector — `attachOutsideClickListener` is added to it. */
  runtime: RuntimeLitImportCollector;
}

export function emitListenerOutsideClick(opts: EmitListenerOutsideClickOpts): string {
  opts.runtime.add('attachOutsideClickListener');
  const refs = opts.refNames.map(
    (r) => `() => this._ref${r.charAt(0).toUpperCase()}${r.slice(1)}`,
  );
  const refsArr = `[${refs.join(', ')}]`;
  const whenFn = opts.whenExpr ? `, () => (${opts.whenExpr})` : '';
  const unsubVar = `_u${opts.index}`;
  return [
    `const ${unsubVar} = attachOutsideClickListener(${refsArr}, (e) => { ${opts.guards.join(' ')} (${opts.handler})(e); }${whenFn});`,
    `this._disconnectCleanups.push(${unsubVar});`,
  ].join('\n');
}
