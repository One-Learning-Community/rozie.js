/**
 * emitListenerNative — Plan 04-04 Task 2 / Class A + Class D emitter.
 *
 * Class A (pure native): modifierPipeline contains only `listenerOption`
 * entries (capture/passive/once) and/or `filter` entries that resolve to
 * `inlineGuard` descriptors (key filters, .stop, .prevent, .self).
 *
 * Class D (pure inlineGuard, no listener-options): same as Class A minus
 * the options-object on `addEventListener`.
 *
 * Output shape — single `useEffect` block per listener:
 *   ```
 *   useEffect(() => {
 *     if (!(when)) return;          // optional — only if listener.when set
 *     const handler = (e: Event) => {
 *       if (e.key !== 'Escape') return;   // inlineGuards from D-65
 *       userHandler(e);
 *     };
 *     document.addEventListener('keydown', handler);
 *     return () => document.removeEventListener('keydown', handler);
 *   }, [props.closeOnEscape, props.open]);  // Listener.deps spread per D-21 / D-61
 *   ```
 *
 * **Listener.deps spread DIRECTLY** into useEffect deps[] — this is the
 * marquee technical claim of the project (REACT-T-02 / D-61).
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
  ReactEmissionDescriptor,
} from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { renderDepArray } from './renderDepArray.js';

export interface EmitListenerNativeResult {
  code: string;
  diagnostics: Diagnostic[];
}

/** Map common DOM events to their TypeScript event constructor names. */
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
 * Render the addEventListener target expression. `<listeners>` block targets:
 *   - global → 'document' / 'window' (both are strings)
 *   - self → '$el' is not currently representable in React (no implicit root
 *     ref) — emit a placeholder + diagnostic if encountered
 *   - ref → `${refName}.current`
 */
function renderTargetExpr(
  target: ListenerTarget,
  diagnostics: Diagnostic[],
  loc: { start: number; end: number },
): string {
  if (target.kind === 'global') return target.name;
  if (target.kind === 'ref') return `${target.refName}.current`;
  // self / $el — Plan 04-04 doesn't add an automatic root ref to React fixtures;
  // this is a known v1 limitation documented in the SUMMARY. Emit ROZ520-class
  // diagnostic and fall back to using `document` so the emitted code at least
  // type-checks. Real fix is a follow-up plan that injects a root ref.
  diagnostics.push({
    code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
    severity: 'warning',
    message: `<listeners> entry with target=$el is not yet supported on the React target — falling back to 'document'`,
    loc,
  });
  return 'document';
}

/**
 * Build the `, { capture: true, passive: true }` options-object suffix.
 * Returns `''` when no options are present.
 */
function renderOptionsSuffix(opts: Set<string>): string {
  if (opts.size === 0) return '';
  const parts = [...opts].sort().map((o) => `${o}: true`);
  return `, { ${parts.join(', ')} }`;
}

/**
 * Indent a multi-line block by `n` spaces.
 */
function indent(text: string, n: number): string {
  const pad = ' '.repeat(n);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n');
}

/**
 * Emit a Class A or Class D listener as a useEffect block. Caller funnels
 * the `useEffect` import via `collectors.react`. Returns the source text
 * (no trailing newline).
 *
 * Optional `wrappedHandlerName` — when set (Class C path), the addEventListener
 * registration uses this wrapper-name as the bound handler instead of building
 * a fresh inner `handler` arrow. The deps array also includes the wrapper name
 * (it's stable identity but exhaustive-deps still wants it listed).
 */
export function emitListenerNative(
  listener: Listener,
  ir: IRComponent,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
  registry: ModifierRegistry,
  options: { wrappedHandlerName?: string } = {},
): EmitListenerNativeResult {
  const diagnostics: Diagnostic[] = [];
  collectors.react.add('useEffect');

  const listenerOptions = new Set<string>();
  const inlineGuards: string[] = [];

  for (const entry of listener.modifierPipeline) {
    if (entry.kind === 'listenerOption') {
      listenerOptions.add(entry.option);
      continue;
    }
    // wrap or filter — resolve via registry's react() hook.
    // wrap+outside / wrap+debounce / wrap+throttle are NOT this codepath;
    // those are routed to Class B / Class C by the orchestrator. We only see
    // wrap entries here when called from Class C (wrap+filter combined) — in
    // that case the wrap entry is already accounted for via wrappedHandlerName,
    // so we only consume the filter/inlineGuard entries.
    const impl = registry.get(entry.modifier);
    if (!impl || !impl.react) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
        severity: 'error',
        message: `Modifier '.${entry.modifier}' has no React emitter (missing react() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }
    const desc: ReactEmissionDescriptor = impl.react(entry.args, {
      source: 'listeners-block',
      event: listener.event,
      sourceLoc: entry.sourceLoc,
    });
    if (desc.kind === 'native') {
      // capture/passive/once option flag on addEventListener.
      listenerOptions.add(desc.token);
      continue;
    }
    if (desc.kind === 'inlineGuard') {
      inlineGuards.push(desc.code);
      continue;
    }
    // helper kind — orchestrator should have routed this away from Native.
    // Skip silently here (Class C will have already emitted the wrapper).
  }

  const evtType = eventTypeFor(listener.event);
  const targetExpr = renderTargetExpr(listener.target, diagnostics, listener.sourceLoc);
  const optionsSuffix = renderOptionsSuffix(listenerOptions);

  const whenGuardLine = listener.when
    ? `  if (!(${rewriteTemplateExpression(listener.when, ir)})) return;\n`
    : '';

  // Render the user handler. For Identifier handlers, call as `name(e)` so
  // the user's signature receives the event arg; for non-Identifier shapes
  // (arrow / call), wrap in (e) => {...} (Pitfall 5).
  const handlerName = options.wrappedHandlerName ?? '_rozieHandler';
  const guardBody = inlineGuards.length > 0
    ? inlineGuards.map((g) => `    ${g}`).join('\n') + '\n'
    : '';

  let depsExpressions: string[] = [];

  let handlerDecl: string;
  let handlerRef: string;
  if (options.wrappedHandlerName) {
    // Class C path: handler is the wrapper name; no inner handler decl needed.
    // But we still apply inlineGuards by wrapping the wrapper in an arrow. If
    // there are no guards, just bind the wrapper directly.
    if (inlineGuards.length === 0) {
      handlerDecl = '';
      handlerRef = options.wrappedHandlerName;
    } else {
      handlerDecl = `  const _rozieGuardedHandler = (e: ${evtType}) => {\n${guardBody}    ${options.wrappedHandlerName}(e);\n  };\n`;
      handlerRef = '_rozieGuardedHandler';
    }
    // Wrapper name is stable across renders but exhaustive-deps wants it listed.
    depsExpressions = [options.wrappedHandlerName];
  } else {
    // Class A / D: build an inner handler from the user's expression.
    const userHandlerCode = rewriteTemplateExpression(listener.handler, ir);
    const handlerIsBareIdentifier = /^[A-Za-z_$][\w$]*$/.test(userHandlerCode);
    const invocation = handlerIsBareIdentifier
      ? `${userHandlerCode}(e);`
      : `(${userHandlerCode});`;
    handlerDecl = `  const ${handlerName} = (e: ${evtType}) => {\n${guardBody}    ${invocation}\n  };\n`;
    handlerRef = handlerName;
  }

  // Build deps[] from Listener.deps (REACT-T-02 marquee — direct spread).
  // Render each SignalRef into an identifier expression and merge with any
  // closure-captured wrapper name from Class C path.
  const baseDepsArray = renderDepArray(listener.deps, ir);
  // If we have additional non-SignalRef deps (Class C wrapper name), splice
  // them into the array. baseDepsArray is `[a, b]` form — strip braces, merge,
  // re-alphabetize.
  let depsArray = baseDepsArray;
  if (depsExpressions.length > 0) {
    const existing = baseDepsArray === '[]' ? [] : baseDepsArray.slice(1, -1).split(', ');
    const merged = [...new Set([...existing, ...depsExpressions])].sort();
    depsArray = `[${merged.join(', ')}]`;
  }

  const addCall = `${targetExpr}.addEventListener('${listener.event}', ${handlerRef}${optionsSuffix});`;
  // No trailing semi — the cleanup arrow `() => removeCall` adds the semi via
  // the surrounding `};` outside the arrow body.
  const removeCallNoSemi = `${targetExpr}.removeEventListener('${listener.event}', ${handlerRef}${optionsSuffix})`;

  const body = [
    `useEffect(() => {`,
    whenGuardLine + handlerDecl + `  ${addCall}`,
    `  return () => ${removeCallNoSemi};`,
    `}, ${depsArray});`,
  ].join('\n');

  return { code: body, diagnostics };
}

// Local helper kept un-exported (callers go through emitListenerNative).
export const __test_only = { eventTypeFor, renderTargetExpr, renderOptionsSuffix, indent };
