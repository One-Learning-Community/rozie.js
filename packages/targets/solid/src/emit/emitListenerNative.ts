/**
 * emitListenerNative — Solid target (P1 stub).
 * P2 fills: native addEventListener → createEffect + onCleanup.
 *
 * @experimental — shape may change before v1.0
 */
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitListenerNativeResult {
  code: string;
  diagnostics: Diagnostic[];
}

export function emitListenerNative(
  eventName: string,
  handlerExpression: string,
  targetExpression: string,
): EmitListenerNativeResult {
  // P1 stub: emit a createEffect block that attaches the listener.
  // P2 fills the full Solid createEffect + onCleanup pattern.
  const code =
    `createEffect(() => {\n` +
    `  // TODO(P2): ${targetExpression}.addEventListener('${eventName}', ${handlerExpression});\n` +
    `  // TODO(P2): add onCleanup to remove the event listener\n` +
    `});`;
  return { code, diagnostics: [] };
}
