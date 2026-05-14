/**
 * emitListenerNative — Solid target (P2 complete implementation).
 *
 * Class A (pure native): modifierPipeline contains listenerOption entries
 * (capture/passive/once) and/or filter entries that resolve to inlineGuard.
 *
 * Class D (pure inlineGuard): same as Class A minus listener options.
 *
 * Output shape — single `createEffect` block per listener:
 *   ```
 *   createEffect(() => {
 *     if (!(when)) return;           // optional — only if listener.when set
 *     const handler = (e: Event) => {
 *       if (e.key !== 'Escape') return;  // inlineGuards
 *       userHandler(e);
 *     };
 *     document.addEventListener('keydown', handler, { passive: true });
 *     onCleanup(() => document.removeEventListener('keydown', handler));
 *   });
 *   ```
 *
 * KEY SOLID DIFFERENCES from React emitListenerNative:
 *   - No dep arrays (Solid's reactivity is fine-grained; createEffect auto-tracks)
 *   - onCleanup() called INSIDE the createEffect callback, not returned from it
 *   - `solidImports.add('createEffect')` + `solidImports.add('onCleanup')`
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  Listener,
  ListenerTarget,
} from '../../../../core/src/ir/types.js';
import type {
  ModifierRegistry,
  SolidEmissionDescriptor,
} from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';

export interface EmitListenerNativeResult {
  code: string;
  diagnostics: Diagnostic[];
}

function eventTypeFor(event: string): string {
  if (
    event === 'click' ||
    event === 'mousedown' ||
    event === 'mouseup' ||
    event === 'mousemove' ||
    event === 'mouseenter' ||
    event === 'mouseleave' ||
    event === 'mouseover' ||
    event === 'mouseout' ||
    event === 'contextmenu'
  )
    return 'MouseEvent';
  if (event === 'keydown' || event === 'keyup' || event === 'keypress')
    return 'KeyboardEvent';
  if (event === 'wheel') return 'WheelEvent';
  if (event === 'touchstart' || event === 'touchend' || event === 'touchmove' || event === 'touchcancel')
    return 'TouchEvent';
  if (event === 'pointerdown' || event === 'pointerup' || event === 'pointermove' || event === 'pointercancel')
    return 'PointerEvent';
  if (event === 'focus' || event === 'blur') return 'FocusEvent';
  if (event === 'input') return 'InputEvent';
  if (event === 'submit') return 'SubmitEvent';
  return 'Event';
}

/**
 * Render the addEventListener target expression.
 *   - global → 'document' / 'window'
 *   - ref → `${refName}Ref` (plain variable in Solid, no .current)
 *   - self → 'document' fallback with diagnostic
 */
function renderTargetExpr(
  target: ListenerTarget,
  diagnostics: Diagnostic[],
  loc: { start: number; end: number },
): string {
  if (target.kind === 'global') return target.name;
  if (target.kind === 'ref') return `${target.refName}Ref`;
  // self / $el — not yet supported, fall back to document
  diagnostics.push({
    code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
    severity: 'warning',
    message: `<listeners> entry with target=$el is not yet supported on the Solid target — falling back to 'document'`,
    loc,
  });
  return 'document';
}

function renderOptionsSuffix(opts: Set<string>): string {
  if (opts.size === 0) return '';
  const parts = [...opts].sort().map((o) => `${o}: true`);
  // Cast to AddEventListenerOptions so that 'passive' and 'once' are accepted
  // when TypeScript resolves specific-event overloads (e.g. window.addEventListener('resize', ...)).
  return `, { ${parts.join(', ')} } as AddEventListenerOptions`;
}

/**
 * Emit a Class A or Class D listener as a createEffect block.
 *
 * Optional `wrappedHandlerName` — when set (Class C path), the addEventListener
 * registration uses this wrapper-name as the bound handler instead of building
 * a fresh inner `handler` arrow.
 */
export function emitListenerNative(
  listener: Listener,
  ir: IRComponent,
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector },
  registry: ModifierRegistry,
  options: { wrappedHandlerName?: string } = {},
): EmitListenerNativeResult {
  const diagnostics: Diagnostic[] = [];
  collectors.solid.add('createEffect');
  collectors.solid.add('onCleanup');

  const listenerOptions = new Set<string>();
  const inlineGuards: string[] = [];

  for (const entry of listener.modifierPipeline) {
    if (entry.kind === 'listenerOption') {
      listenerOptions.add(entry.option);
      continue;
    }
    const impl = registry.get(entry.modifier);
    if (!impl || !impl.solid) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_SOLID_RESERVED,
        severity: 'error',
        message: `Modifier '.${entry.modifier}' has no Solid emitter (missing solid() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }
    const desc: SolidEmissionDescriptor = impl.solid(entry.args, {
      source: 'listeners-block',
      event: listener.event,
      sourceLoc: entry.sourceLoc,
    });
    if (desc.kind === 'native') {
      listenerOptions.add(desc.token);
      continue;
    }
    if (desc.kind === 'inlineGuard') {
      inlineGuards.push(desc.code);
      continue;
    }
    // helper kind: orchestrator should have routed this to Class B/C. Skip silently.
  }

  const evtType = eventTypeFor(listener.event);
  const targetExpr = renderTargetExpr(listener.target, diagnostics, listener.sourceLoc);
  const optionsSuffix = renderOptionsSuffix(listenerOptions);

  const whenGuardLine = listener.when
    ? `  if (!(${rewriteTemplateExpression(listener.when, ir)})) return;\n`
    : '';

  const handlerName = options.wrappedHandlerName ?? '_rozieHandler';
  const guardBody = inlineGuards.length > 0
    ? inlineGuards.map((g) => `    ${g}`).join('\n') + '\n'
    : '';

  let handlerDecl: string;
  let handlerRef: string;

  if (options.wrappedHandlerName) {
    if (inlineGuards.length === 0) {
      handlerDecl = '';
      handlerRef = options.wrappedHandlerName;
    } else {
      handlerDecl = `  const _rozieGuardedHandler = (e: ${evtType}) => {\n${guardBody}    ${options.wrappedHandlerName}(e);\n  };\n`;
      handlerRef = '_rozieGuardedHandler';
    }
  } else {
    const userHandlerCode = rewriteTemplateExpression(listener.handler, ir);
    const handlerIsBareIdentifier = /^[A-Za-z_$][\w$]*$/.test(userHandlerCode);
    // Bare identifier handlers (e.g. `close`) are called without the event
    // argument so that TypeScript does not complain when the handler type is
    // `() => void` (TS2554: Expected 0 arguments but got 1). Inline expressions
    // (e.g. arrow functions already declared with an `e` param) receive `e`
    // to preserve the intended semantics.
    const invocation = handlerIsBareIdentifier
      ? `${userHandlerCode}();`
      : `(${userHandlerCode});`;
    handlerDecl = `  const ${handlerName} = (e: ${evtType}) => {\n${guardBody}    ${invocation}\n  };\n`;
    handlerRef = handlerName;
  }

  const addCall = `  ${targetExpr}.addEventListener('${listener.event}', ${handlerRef}${optionsSuffix});`;
  // Solid: onCleanup() called INSIDE the createEffect, not returned
  const cleanupCall = `  onCleanup(() => ${targetExpr}.removeEventListener('${listener.event}', ${handlerRef}${optionsSuffix}));`;

  const body = [
    `createEffect(() => {`,
    whenGuardLine + handlerDecl + addCall,
    cleanupCall,
    `});`,
  ].join('\n');

  return { code: body, diagnostics };
}
