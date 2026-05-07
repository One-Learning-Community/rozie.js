/**
 * emitSlotInvocation — Solid target (P1 stub).
 * P2 fills: D-133 call-site patterns for Solid slots.
 *
 * @experimental — shape may change before v1.0
 */
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitSlotInvocationResult {
  jsx: string;
  diagnostics: Diagnostic[];
}

export function emitSlotInvocation(
  slotName: string,
  _ctxExpression?: string,
): EmitSlotInvocationResult {
  // P1 stub — P2 fills D-133 call-site pattern.
  if (slotName === '') {
    return { jsx: '{resolved()}', diagnostics: [] };
  }
  return { jsx: `{local.${slotName}}`, diagnostics: [] };
}
