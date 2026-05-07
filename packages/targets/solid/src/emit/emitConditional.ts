/**
 * emitConditional — Solid target (P1 stub).
 * P2 fills: r-if/r-else → <Show when={...}> / fallback.
 *
 * @experimental — shape may change before v1.0
 */
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitConditionalResult {
  jsx: string;
  diagnostics: Diagnostic[];
}

export function emitConditional(
  condition: string,
  consequent: string,
  alternate?: string,
): EmitConditionalResult {
  // P1 minimal: emit a ternary expression.
  // P2 will use <Show when={...}> for Solid idiom.
  const jsx = alternate !== undefined
    ? `{${condition} ? (${consequent}) : (${alternate})}`
    : `{${condition} && (${consequent})}`;
  return { jsx, diagnostics: [] };
}
