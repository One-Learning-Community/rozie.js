/**
 * emitListenerWrap — Solid target (P2 complete implementation).
 *
 * Wraps a `<listeners>`-block handler with `createDebouncedHandler` /
 * `createThrottledHandler` at component body level, then attaches the wrapper
 * via `createEffect` + `addEventListener`.
 *
 * Returns BOTH:
 *   - `scriptInjection`: wrapper-construction line
 *     `const _rozieThrottledLReposition = createThrottledHandler(reposition, 100);`
 *   - `createEffectCode`: the createEffect block referencing the wrapper
 *
 * KEY SOLID DIFFERENCES from React emitListenerWrap:
 *   - No deps array (createDebouncedHandler/createThrottledHandler don't take deps)
 *   - createEffect + onCleanup instead of useEffect with return cleanup fn
 *   - Helper names: createDebouncedHandler / createThrottledHandler (not use* hooks)
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  Listener,
} from '../../../../core/src/ir/types.js';
import type {
  ModifierRegistry,
} from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { emitListenerNative } from './emitListenerNative.js';

export interface EmitListenerWrapResult {
  scriptInjection: string;
  createEffectCode: string;
  diagnostics: Diagnostic[];
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function renderModifierArgInline(arg: ModifierArg): string {
  if (arg.kind === 'literal') return JSON.stringify(arg.value);
  return arg.ref;
}

/**
 * Build a stable wrapper name using `L` namespace prefix (listeners-block)
 * to avoid collision with template @event wraps.
 */
function makeWrapName(
  helperName: 'createDebouncedHandler' | 'createThrottledHandler',
  baseHandlerName: string,
  counter: { next: number },
): string {
  const namespace = helperName === 'createDebouncedHandler' ? '_rozieDebounceL' : '_rozieThrottleL';
  const cap = capitalize(baseHandlerName);
  const N = counter.next++;
  return N === 0 ? `${namespace}${cap}` : `${namespace}${cap}_${N}`;
}

/**
 * Emit a Class C listener:
 *   1. Wrapper const at script-body level (returned in `scriptInjection`)
 *   2. createEffect block using the wrapper (returned in `createEffectCode`)
 */
export function emitListenerWrap(
  listener: Listener,
  helperName: 'createDebouncedHandler' | 'createThrottledHandler',
  helperArgs: ModifierArg[],
  ir: IRComponent,
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector },
  registry: ModifierRegistry,
  wrapCounter: { next: number },
): EmitListenerWrapResult {
  const diagnostics: Diagnostic[] = [];
  collectors.runtime.add(helperName);

  const userHandlerCode = rewriteTemplateExpression(listener.handler, ir);
  const handlerIsBareIdentifier = /^[A-Za-z_$][\w$]*$/.test(userHandlerCode);
  const baseName = handlerIsBareIdentifier ? userHandlerCode : `handler${wrapCounter.next}`;

  const wrapName = makeWrapName(helperName, baseName, wrapCounter);
  const wrapArgsList = helperArgs.map(renderModifierArgInline).join(', ');

  // Solid: createDebouncedHandler/createThrottledHandler do NOT take deps arrays.
  // Signature: createDebouncedHandler(fn, ms) → wrapped handler function.
  const scriptInjection = `const ${wrapName} = ${helperName}(${userHandlerCode}${wrapArgsList ? ', ' + wrapArgsList : ''});`;

  if (helperName !== 'createDebouncedHandler' && helperName !== 'createThrottledHandler') {
    diagnostics.push({
      code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
      severity: 'error',
      message: `emitListenerWrap called with unsupported helper '${helperName}'`,
      loc: listener.sourceLoc,
    });
  }

  // Build the createEffect block via emitListenerNative with wrapper name.
  const native = emitListenerNative(listener, ir, collectors, registry, {
    wrappedHandlerName: wrapName,
  });
  diagnostics.push(...native.diagnostics);

  return {
    scriptInjection,
    createEffectCode: native.code,
    diagnostics,
  };
}
