/**
 * emitListenerWrap — Lit debounce/throttle wrap emission (Plan 06.4-02 Task 1).
 *
 * Emits an inline IIFE that wraps the user handler with setTimeout-based
 * debounce or throttle semantics. No runtime export — wrap is inlined to
 * keep emitted .ts files self-contained for the common case.
 *
 * NOTE (WR-05): This module is NOT currently called by the emitListeners.ts
 * orchestrator — the orchestrator inlines equivalent debounce/throttle logic
 * directly. This standalone helper exists for unit-testing and future Phase 7
 * unification.
 * TODO(Phase 7): refactor emitListeners.ts to call emitListenerWrap here.
 *
 * @experimental — shape may change before v1.0
 */

export interface EmitListenerWrapOpts {
  kind: 'debounce' | 'throttle';
  /** Wait window in milliseconds. */
  ms: number;
  /** Rewritten user handler (string form). */
  handler: string;
  /** Inline filter guards. */
  guards: string[];
  /** Optional when-guard expression. */
  whenExpr: string | null;
}

export function emitListenerWrap(opts: EmitListenerWrapOpts): string {
  const guardLines: string[] = [];
  if (opts.whenExpr) guardLines.push(`if (!(${opts.whenExpr})) return;`);
  guardLines.push(...opts.guards);
  if (opts.kind === 'debounce') {
    return `(() => { let t: ReturnType<typeof setTimeout> | undefined; return (e: Event) => { ${guardLines.join(' ')} if (t) clearTimeout(t); t = setTimeout(() => { (${opts.handler})(e); }, ${opts.ms}); }; })()`;
  }
  return `(() => { let last = 0; return (e: Event) => { ${guardLines.join(' ')} const now = Date.now(); if (now - last < ${opts.ms}) return; last = now; (${opts.handler})(e); }; })()`;
}
