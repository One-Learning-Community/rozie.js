/**
 * emitHostListenerWiring — D-LIT-12 host-listener wiring for scoped slot
 * function-typed params (Plan 06.4-02 Task 2).
 *
 * Scoped-slot consumers cannot inline function bodies inside `data-rozie-params`
 * (JSON serialization breaks). The v1 compromise (D-LIT-12) is that
 * function-typed slot params flow upward via CustomEvent dispatch from the
 * slotted child element; the host registers a listener that calls the
 * user-supplied slot.params.<fn> function with `event.detail`.
 *
 * Event name convention: `rozie-<slotName>-<paramName>` with `default` for
 * the unnamed default slot.
 *
 * @experimental — shape may change before v1.0
 */
export interface EmitHostListenerWiringOpts {
  slotName: string;
  paramName: string;
  /** Stringified handler that takes the user's slot.params.<paramName> arg.
   *  In a Lit class this is typically a `this.<method>` reference. */
  handlerExpr: string;
}

export function emitHostListenerWiring(opts: EmitHostListenerWiringOpts): string {
  const eventName = `rozie-${opts.slotName === '' ? 'default' : opts.slotName}-${opts.paramName}`;
  return `this.addEventListener('${eventName}', (e) => { (${opts.handlerExpr})((e as CustomEvent).detail); });`;
}
