/**
 * emitListenerWrap — Solid target (P1 stub).
 * P2 fills: .debounce(ms)/.throttle(ms) → createDebouncedHandler/createThrottledHandler.
 *
 * @experimental — shape may change before v1.0
 */
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';

export type WrapKind = 'debounce' | 'throttle';

export interface EmitListenerWrapResult {
  wrapperConst: string;
  wrappedHandlerName: string;
  diagnostics: Diagnostic[];
}

export function emitListenerWrap(
  kind: WrapKind,
  handlerExpression: string,
  ms: number,
  wrapperName: string,
  runtimeImports: RuntimeSolidImportCollector,
): EmitListenerWrapResult {
  if (kind === 'debounce') {
    runtimeImports.add('createDebouncedHandler');
    const wrapperConst = `const ${wrapperName} = createDebouncedHandler(${handlerExpression}, ${ms});`;
    return { wrapperConst, wrappedHandlerName: wrapperName, diagnostics: [] };
  } else {
    runtimeImports.add('createThrottledHandler');
    const wrapperConst = `const ${wrapperName} = createThrottledHandler(${handlerExpression}, ${ms});`;
    return { wrapperConst, wrappedHandlerName: wrapperName, diagnostics: [] };
  }
}
