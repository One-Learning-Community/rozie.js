/**
 * emitListenerOutsideClick — Solid target (P1 stub).
 * P2 fills: .outside modifier → createOutsideClick from @rozie/runtime-solid.
 *
 * @experimental — shape may change before v1.0
 */
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';

export interface EmitListenerOutsideClickResult {
  code: string;
  diagnostics: Diagnostic[];
}

export function emitListenerOutsideClick(
  refExpressions: string[],
  handlerExpression: string,
  runtimeImports: RuntimeSolidImportCollector,
): EmitListenerOutsideClickResult {
  runtimeImports.add('createOutsideClick');
  // P1 stub: wire the import, emit a placeholder.
  // P2 fills: createOutsideClick([...refs], handler, when).
  const refsArray = refExpressions.map((r) => `() => ${r}`).join(', ');
  const code = `createOutsideClick([${refsArray}], ${handlerExpression});`;
  return { code, diagnostics: [] };
}
