/**
 * emitListenerOutsideClick.ts — P1 stub for `.outside(...refs)` modifier emission.
 *
 * P2 emits a call to `attachOutsideClickListener(refs, handler, when)` from
 * `@rozie/runtime-lit`. The runtime helper uses `e.composedPath()` to correctly
 * handle shadow-DOM-encapsulated refs. The returned unsubscribe is pushed to
 * `this._disconnectCleanups`.
 *
 * @experimental — shape may change before v1.0
 */

export function emitListenerOutsideClick(): string {
  return '';
}
