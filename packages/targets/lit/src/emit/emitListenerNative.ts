/**
 * emitListenerNative — Lit native event-listener emission (Plan 06.4-02 Task 1).
 *
 * Returns the wiring lines for a Class-A (pure native) or Class-D (filter
 * guards) listener:
 *
 *   const _lh = (e) => { guards; userHandler(e); };
 *   target.addEventListener('event', _lh, options);
 *   this._disconnectCleanups.push(() => target.removeEventListener('event', _lh, options));
 *
 * NOTE (WR-05): This module is NOT currently called by the emitListeners.ts
 * orchestrator — the orchestrator inlines equivalent logic directly. This
 * standalone helper exists for unit-testing and future Phase 7 unification.
 * TODO(Phase 7): refactor emitListeners.ts to call emitListenerNative here.
 *
 * @experimental — shape may change before v1.0
 */

export interface EmitListenerNativeOpts {
  target: string;
  eventName: string;
  handler: string;
  /** Listener options object source ('undefined' or '{ capture: true, ... }'). */
  options: string;
  /** Inline guards prepended to the handler body. */
  guards: string[];
  /** Optional when-guard (whole listener becomes a no-op if when() is false). */
  whenExpr: string | null;
  /** Index for unique variable naming. */
  index: number;
}

export function emitListenerNative(opts: EmitListenerNativeOpts): string {
  const guardLines: string[] = [];
  if (opts.whenExpr) guardLines.push(`if (!(${opts.whenExpr})) return;`);
  guardLines.push(...opts.guards);
  const body = `(e: Event) => { ${guardLines.join(' ')} (${opts.handler})(e); }`;
  const handlerVar = `_h${opts.index}`;
  return [
    `const ${handlerVar} = ${body};`,
    `${opts.target}.addEventListener('${opts.eventName}', ${handlerVar}, ${opts.options});`,
    `this._disconnectCleanups.push(() => ${opts.target}.removeEventListener('${opts.eventName}', ${handlerVar}, ${opts.options}));`,
  ].join('\n');
}
