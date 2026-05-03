/**
 * emitTemplateEvent — Plan 04-03 Task 3 (React target).
 *
 * Renders a template @event Listener as a JSX `onClick={...}` (or analogous)
 * attribute, plus optional script-injection lines for helper-modifier wraps.
 *
 * Modifier resolution per D-65 ReactEmissionDescriptor:
 *   - 'inlineGuard' kind — prepend code into a synthetic arrow handler before
 *     calling the user handler. e.g., `e.stopPropagation();` from .stop.
 *   - 'native' kind — capture-only is supported via the JSX onClickCapture
 *     suffix. .passive / .once on JSX events have no native form (addEventListener
 *     options); emit an info diagnostic and fall through to inline guard fallback
 *     where possible (no-op for .passive on JSX).
 *   - 'helper' kind — debounce/throttle wraps require a hook call at component-body
 *     top; emit a script-injection `const debouncedX = useDebouncedCallback(...)`
 *     and reference the wrap name in the JSX attribute. .outside is listenerOnly
 *     and emits ROZ520-class diagnostic on template @event.
 *
 * Edge cases:
 *   - When no modifiers AND handler is a bare Identifier: emit `onClick={handler}`
 *     directly (no arrow wrapper).
 *   - When modifiers present OR handler is a CallExpression/ArrowFunction: wrap in
 *     synthetic `(e) => { ...inlineGuards; userHandler(e); }`.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type {
  IRComponent,
  Listener,
} from '../../../../core/src/ir/types.js';
import type {
  ModifierRegistry,
  ReactEmissionDescriptor,
} from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

export interface EmitEventCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector };
  /** Per-component counter for stable wrap-name suffixes. */
  injectionCounter: { next: number };
}

export interface EmitTemplateEventResult {
  /** The JSX attribute like `onClick={handler}` */
  jsxAttr: string;
  /** Top-of-component-body lines (e.g., `const _rozieDebouncedSearch = ...`). */
  scriptInjection: string | null;
  diagnostics: Diagnostic[];
}

/**
 * Convert an event name (e.g., 'click', 'mouseenter') to a JSX prop (e.g.,
 * 'onClick', 'onMouseEnter'). Capture suffix is appended later if .capture
 * modifier is detected.
 */
function eventNameToJsxProp(eventName: string): string {
  // Standard Web events become onXxx where Xxx is event with first letter
  // upper-cased. Hyphenated event-names (rare in JSX) get camelCased.
  const parts = eventName.split(/[-_]/).filter(Boolean);
  const cap = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return 'on' + cap;
}

/**
 * Render a ModifierArg as a JS source string for inlining into the wrap call.
 */
function renderModifierArg(arg: ModifierArg): string {
  if (arg.kind === 'literal') {
    return JSON.stringify(arg.value);
  }
  return arg.ref;
}

/**
 * Compose a stable wrap-name for a debounce/throttle wrap:
 *   debouncedOnSearch / throttledReposition_1 / etc.
 */
function makeWrapName(
  helperName: 'useDebouncedCallback' | 'useThrottledCallback' | 'useOutsideClick',
  handler: t.Expression,
  counter: { next: number },
): string {
  const baseName = t.isIdentifier(handler) ? handler.name : `handler${counter.next}`;
  const cap = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const prefix =
    helperName === 'useDebouncedCallback' ? '_rozieDebounced' :
    helperName === 'useThrottledCallback' ? '_rozieThrottled' :
    '_rozieOutside';
  const N = counter.next++;
  return N === 0 ? `${prefix}${cap}` : `${prefix}${cap}_${N}`;
}

/**
 * Render the user handler expression as a JSX-compatible source string.
 */
function renderHandler(handler: t.Expression, ir: IRComponent): string {
  return rewriteTemplateExpression(handler, ir);
}

/**
 * Emit a single template @event listener as a JSX attribute.
 */
export function emitTemplateEvent(
  listener: Listener,
  ctx: EmitEventCtx,
): EmitTemplateEventResult {
  const diagnostics: Diagnostic[] = [];
  const eventName = listener.event;
  let jsxName = eventNameToJsxProp(eventName);

  const inlineGuards: string[] = []; // Code lines before handler invocation
  let scriptInjection: string | null = null;
  let handlerRef: string | null = null; // If a wrap is created, JSX uses this name

  for (const entry of listener.modifierPipeline) {
    let modifierName: string;
    let modifierArgs: ModifierArg[];

    if (entry.kind === 'listenerOption') {
      modifierName = entry.option;
      modifierArgs = [];
    } else {
      modifierName = entry.modifier;
      modifierArgs = entry.args;
    }

    const impl = ctx.registry.get(modifierName);
    if (!impl || !impl.react) {
      // No react() hook — emit ROZ520-class diagnostic. Plan 04-04 broadens the
      // "missing-hook" diagnostic surface; v1 reuses ROZ520 for any react-side
      // template-event modifier that has no descriptor.
      diagnostics.push({
        code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
        severity: 'error',
        message: `Modifier '.${modifierName}' has no React emitter (missing react() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    const desc: ReactEmissionDescriptor = impl.react(modifierArgs, {
      source: 'template-event',
      event: eventName,
      sourceLoc: entry.sourceLoc,
    });

    if (desc.kind === 'native') {
      if (desc.token === 'capture') {
        // Append Capture suffix to JSX prop name: onClick → onClickCapture.
        jsxName = jsxName + 'Capture';
      } else {
        // .passive / .once on JSX events have no native form; emit an info
        // diagnostic and skip (the JSX prop will fire normally without the
        // option flag — observable behavior for .once differs minimally as
        // re-fires are uncommon for typical JSX usage; .passive likewise).
        diagnostics.push({
          code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
          severity: 'warning',
          message: `Modifier '.${desc.token}' has no JSX-prop equivalent in React (addEventListener-only). Move handler to <listeners> block to use this modifier.`,
          loc: entry.sourceLoc,
        });
      }
      continue;
    }

    if (desc.kind === 'inlineGuard') {
      inlineGuards.push(desc.code);
      continue;
    }

    // helper kind
    if (desc.listenerOnly === true) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
        severity: 'error',
        message: `Modifier '.${modifierName}' is listenerOnly (D-65) — only valid in <listeners> blocks, not on template @event bindings.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    if (desc.helperName === 'useDebouncedCallback' || desc.helperName === 'useThrottledCallback') {
      ctx.collectors.runtime.add(desc.helperName);
      const originalHandlerCode = renderHandler(listener.handler, ctx.ir);
      const wrapName = makeWrapName(desc.helperName, listener.handler, ctx.injectionCounter);
      const argList = desc.args.map(renderModifierArg).join(', ');
      // Plan 04-04 will refine the deps array; v1 emits []
      const injection = `const ${wrapName} = ${desc.helperName}(${originalHandlerCode}, []${argList ? ', ' + argList : ''});`;
      scriptInjection = injection;
      handlerRef = wrapName;
      continue;
    }

    // useOutsideClick on a template @event — listenerOnly violation handled above.
    diagnostics.push({
      code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
      severity: 'error',
      message: `Modifier helper '${desc.helperName}' is not supported on template @event bindings.`,
      loc: entry.sourceLoc,
    });
  }

  // Compose the handler expression
  let handlerExpr: string;
  if (handlerRef !== null && inlineGuards.length === 0) {
    // Pure helper-wrap: just reference the wrap name.
    handlerExpr = handlerRef;
  } else if (inlineGuards.length === 0) {
    // No modifiers — render handler directly.
    if (t.isIdentifier(listener.handler)) {
      handlerExpr = renderHandler(listener.handler, ctx.ir);
    } else {
      // Inline expression like `$props.closeOnBackdrop && close()` — wrap in arrow.
      const code = renderHandler(listener.handler, ctx.ir);
      handlerExpr = `(e) => { ${code}; }`;
    }
  } else {
    // Has inline guards: wrap in synthetic (e) => {...} arrow.
    const guardLines = inlineGuards.join(' ');
    const handlerInvocation = handlerRef !== null
      ? `${handlerRef}(e)`
      : (t.isIdentifier(listener.handler)
          ? `${renderHandler(listener.handler, ctx.ir)}(e)`
          : renderHandler(listener.handler, ctx.ir));
    handlerExpr = `(e) => { ${guardLines} ${handlerInvocation}; }`;
  }

  return {
    jsxAttr: `${jsxName}={${handlerExpr}}`,
    scriptInjection,
    diagnostics,
  };
}
