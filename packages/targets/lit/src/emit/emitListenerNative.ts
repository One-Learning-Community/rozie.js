/**
 * emitListenerNative — Lit native event-listener emission (Plan 06.4-02 Task 1).
 *
 * Returns the wiring lines for a Class-A (pure native) or Class-D (filter
 * guards) listener:
 *
 *   const _h = (e) => { guards; userHandler(e); };
 *   target.addEventListener('event', _h, options);
 *   this._disconnectCleanups.push(() => target.removeEventListener('event', _h, options));
 *
 * The orchestrator in emitListeners.ts uses this shape directly; this module
 * exposes a stand-alone helper for tests + future re-use.
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
