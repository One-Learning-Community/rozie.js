/**
 * emitSlotInvocation.ts — P1 stub for `<slot>` invocation emission.
 *
 * P2 emits `<slot name="X" data-rozie-params=${JSON.stringify(ctx)}>` per
 * D-LIT-11; named slots with scoped params expose ctx to slotted children via
 * the `data-rozie-params` attribute consumed by `observeRozieSlotCtx`.
 *
 * @experimental — shape may change before v1.0
 */

export function emitSlotInvocation(): string {
  return '';
}
