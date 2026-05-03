/**
 * emitListenerWrap — Plan 04-04 Task 2 / Class C emitter.
 *
 * Wraps a `<listeners>`-block handler with `useDebouncedCallback` /
 * `useThrottledCallback` at script-body level, then attaches the wrapper
 * via `useEffect` + `addEventListener`.
 *
 * Returns BOTH:
 *   - `scriptInjection`: top-of-function-body wrapper-construction line
 *     `const _rozieThrottledReposition = useThrottledCallback(reposition, [props.open], 100);`
 *   - `useEffectCode`: the useEffect block referencing the wrapper
 *
 * Shell.ts already slots scriptInjections AFTER user arrows (per Wave 0
 * spike Variant A; see commit 3e57a33), so the wrapper can safely reference
 * user-authored handlers like `reposition`.
 *
 * The wrap emitter delegates the useEffect-block construction to
 * `emitListenerNative` with `wrappedHandlerName: <wrapName>` so inlineGuards
 * and listenerOptions are respected uniformly across classes.
 *
 * Wrapper-name namespace is `_rozieDebouncedL*` / `_rozieThrottledL*` (the
 * `L` suffix for "listeners block") so it can never collide with template
 * @event wraps which use `_rozieDebounced*` / `_rozieThrottled*` (no L).
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
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { renderDepArray } from './renderDepArray.js';
import { emitListenerNative } from './emitListenerNative.js';

export interface EmitListenerWrapResult {
  scriptInjection: string;
  useEffectCode: string;
  diagnostics: Diagnostic[];
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function renderModifierArgInline(arg: ModifierArg): string {
  if (arg.kind === 'literal') return JSON.stringify(arg.value);
  return arg.ref; // refExpr — bare identifier (rare for debounce/throttle)
}

/**
 * Build a stable wrapper name. The `L` namespace prefix prevents collision
 * with template-event wraps (which use `_rozieDebounced*` w/o L).
 */
function makeWrapName(
  helperName: 'useDebouncedCallback' | 'useThrottledCallback',
  baseHandlerName: string,
  counter: { next: number },
): string {
  const namespace = helperName === 'useDebouncedCallback' ? '_rozieDebouncedL' : '_rozieThrottledL';
  const cap = capitalize(baseHandlerName);
  const N = counter.next++;
  return N === 0 ? `${namespace}${cap}` : `${namespace}${cap}_${N}`;
}

/**
 * Emit a Class C listener:
 *   1. Construct wrapper at script-body level (returned in `scriptInjection`)
 *   2. Attach via useEffect (returned in `useEffectCode`)
 */
export function emitListenerWrap(
  listener: Listener,
  helperName: 'useDebouncedCallback' | 'useThrottledCallback',
  helperArgs: ModifierArg[],
  ir: IRComponent,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
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
  // Wrapper construction. Per RESEARCH Pattern 10 Class C:
  //   const _rozieThrottledLReposition = useThrottledCallback(reposition, [props.open], 100);
  // The deps[] argument is `Listener.deps` — same set as the useEffect deps[],
  // because the wrapper closure captures the same reactive values the user
  // handler reads.
  const depsLiteral = renderDepArray(listener.deps, ir);
  const scriptInjection = `const ${wrapName} = ${helperName}(${userHandlerCode}, ${depsLiteral}${wrapArgsList ? ', ' + wrapArgsList : ''});`;

  // Now build the useEffect via emitListenerNative with the wrapper name.
  // The native emitter handles inlineGuards + listenerOptions + when guard.
  const native = emitListenerNative(listener, ir, collectors, registry, {
    wrappedHandlerName: wrapName,
  });
  diagnostics.push(...native.diagnostics);

  // Validation: helper name must match registry (debounce / throttle only).
  if (helperName !== 'useDebouncedCallback' && helperName !== 'useThrottledCallback') {
    diagnostics.push({
      code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
      severity: 'error',
      message: `emitListenerWrap called with unsupported helper '${helperName}' — internal invariant violation`,
      loc: listener.sourceLoc,
    });
  }

  return {
    scriptInjection,
    useEffectCode: native.code,
    diagnostics,
  };
}
