/**
 * emitTemplateEvent — Phase 5 Plan 05-04a Task 2.
 *
 * Renders a template `@event[.modifier...]="handler"` Listener into Angular
 * `(eventName)="..."` event bindings.
 *
 * Modifier-descriptor handling (per ModifierImpl.angular() hook):
 *   - `kind: 'inlineGuard'` — append the guard's `code` before the handler
 *     invocation in a synthesized arrow body.
 *   - `kind: 'helper'` with `helperName: 'debounce' | 'throttle'` — emit a
 *     class-body field initializer (debouncedX / throttledX IIFE wrapper) and
 *     bind the wrapped name as the event handler.
 *   - `kind: 'helper'` with `listenerOnly: true` (.outside) — ROZ722 (only
 *     valid in <listeners> blocks).
 *   - `kind: 'native'` (capture/passive/once) — REJECTED in template-event
 *     context with ROZ722. Native event-listener options are valid only in
 *     <listeners> blocks where they map onto Renderer2.listen options.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws; pushes diagnostics.
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
  AngularEmissionDescriptor,
} from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface AngularScriptInjection {
  /** Field name (e.g., `debouncedOnSearch`). */
  name: string;
  /** Full class-body field declaration text (line). */
  decl: string;
}

export interface EmitEventCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  loopBindings?: ReadonlySet<string> | undefined;
  /** Per-component counter so suffix names are stable + collision-free. */
  injectionCounter?: { next: number } | undefined;
}

export interface EmitTemplateEventResult {
  /** Emitted attribute string, e.g., `(click)="handler($event)"`. */
  eventAttr: string;
  /** Optional class-body field injection (debounce/throttle IIFE wrap). */
  scriptInjection?: AngularScriptInjection;
  diagnostics: Diagnostic[];
}

function renderModifierArg(arg: ModifierArg): string {
  if (arg.kind === 'literal') return JSON.stringify(arg.value);
  return arg.ref;
}

function makeWrapName(
  helperName: 'debounce' | 'throttle',
  handler: t.Expression,
  counter: { next: number },
): string {
  let baseName = '';
  if (t.isIdentifier(handler)) {
    baseName = handler.name;
  } else {
    baseName = `handler${counter.next}`;
  }
  const cap = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const prefix = helperName === 'debounce' ? 'debounced' : 'throttled';
  const N = counter.next++;
  return N === 0 ? `${prefix}${cap}` : `${prefix}${cap}_${N}`;
}

/**
 * Inline IIFE for a debounce wrapper as a class-body field initializer.
 * Used as `private debouncedFoo = (() => { ... })();` per OQ A8/A9 RESOLVED
 * (no @rozie/runtime-angular).
 */
function buildDebounceIIFE(wrapName: string, origCode: string, ms: string): string {
  return [
    `private ${wrapName} = (() => {`,
    `  let timer: ReturnType<typeof setTimeout> | null = null;`,
    `  return (...args: any[]) => {`,
    `    if (timer !== null) clearTimeout(timer);`,
    `    timer = setTimeout(() => (${origCode})(...args), ${ms});`,
    `  };`,
    `})();`,
  ].join('\n');
}

function buildThrottleIIFE(wrapName: string, origCode: string, ms: string): string {
  return [
    `private ${wrapName} = (() => {`,
    `  let lastCall = 0;`,
    `  return (...args: any[]) => {`,
    `    const now = Date.now();`,
    `    if (now - lastCall < ${ms}) return;`,
    `    lastCall = now;`,
    `    (${origCode})(...args);`,
    `  };`,
    `})();`,
  ].join('\n');
}

function classifyHandler(node: t.Expression): 'identifier' | 'callable' | 'statement' {
  if (t.isIdentifier(node)) return 'identifier';
  if (
    t.isArrowFunctionExpression(node) ||
    t.isFunctionExpression(node) ||
    t.isMemberExpression(node) ||
    t.isOptionalMemberExpression(node)
  ) {
    return 'callable';
  }
  if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
    return 'statement';
  }
  if (
    t.isAssignmentExpression(node) ||
    t.isSequenceExpression(node) ||
    t.isLogicalExpression(node) ||
    t.isUpdateExpression(node) ||
    t.isUnaryExpression(node) ||
    t.isBinaryExpression(node) ||
    t.isConditionalExpression(node)
  ) {
    return 'statement';
  }
  return 'statement';
}

export function emitTemplateEvent(
  listener: Listener,
  ctx: EmitEventCtx,
): EmitTemplateEventResult {
  const diagnostics: Diagnostic[] = [];
  const counter = ctx.injectionCounter ?? { next: 0 };
  const eventName = listener.event;

  const inlineGuards: string[] = [];
  let scriptInjection: AngularScriptInjection | undefined;
  let handlerKind = classifyHandler(listener.handler);
  let handlerRef: string = rewriteTemplateExpression(listener.handler, ctx.ir, {
    collisionRenames: ctx.collisionRenames,
    loopBindings: ctx.loopBindings,
  });

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
    if (!impl || !impl.angular) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_ANGULAR_RESERVED, // ROZ722
        severity: 'error',
        message: `Modifier '.${modifierName}' has no Angular emitter (missing angular() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    const descriptor: AngularEmissionDescriptor = impl.angular(modifierArgs, {
      source: 'template-event',
      event: eventName,
      sourceLoc: entry.sourceLoc,
    });

    if (descriptor.kind === 'native') {
      // Native option flags are valid only in <listeners>-block context.
      diagnostics.push({
        code: RozieErrorCode.TARGET_ANGULAR_RESERVED, // ROZ722
        severity: 'error',
        message: `Modifier '.${modifierName}' emits a native '${descriptor.token}' option, which Angular does NOT support on template @event bindings. Move this modifier to a <listeners> block.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    if (descriptor.kind === 'inlineGuard') {
      inlineGuards.push(descriptor.code);
      continue;
    }

    // descriptor.kind === 'helper'
    if (descriptor.listenerOnly === true) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_ANGULAR_RESERVED, // ROZ722
        severity: 'error',
        message: `Modifier '.${modifierName}' is listenerOnly — only valid in <listeners> blocks, not on template @event bindings.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    if (descriptor.helperName === 'debounce' || descriptor.helperName === 'throttle') {
      const wrapName = makeWrapName(descriptor.helperName, listener.handler, counter);
      const argList = descriptor.args.map(renderModifierArg);
      const ms = argList[0] ?? '0';
      const origHandlerCode = rewriteTemplateExpression(listener.handler, ctx.ir, {
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
      });
      // Inside the field initializer, the handler-call references `this.X`
      // class members. Rewrite the original handler code through a "this-prefix"
      // pass — for v1 we pass it verbatim because the only handlers exercised
      // are bare identifiers (e.g., onSearch) which need `this.onSearch`.
      // For Counter/SearchInput/Modal/TodoList/Dropdown the IIFE wraps a
      // user-method identifier, so we need `this.${origHandlerCode}` if it's
      // bare. For Dropdown's `reposition` etc., this is the case.
      const wrappedHandlerCode = /^[a-zA-Z_$][\w$]*$/.test(origHandlerCode)
        ? `this.${origHandlerCode}`
        : origHandlerCode;
      const decl =
        descriptor.helperName === 'debounce'
          ? buildDebounceIIFE(wrapName, wrappedHandlerCode, ms)
          : buildThrottleIIFE(wrapName, wrappedHandlerCode, ms);
      scriptInjection = { name: wrapName, decl };
      handlerRef = wrapName;
      handlerKind = 'identifier';
      continue;
    }

    diagnostics.push({
      code: RozieErrorCode.TARGET_ANGULAR_RESERVED, // ROZ722
      severity: 'error',
      message: `Modifier '.${modifierName}' helper '${descriptor.helperName}' is not supported on template @event bindings.`,
      loc: entry.sourceLoc,
    });
  }

  // Compose the handler attribute. Angular event-binding syntax:
  //   (eventName)="handler($event)" or (eventName)="<expr>"
  let attrValue: string;
  if (inlineGuards.length === 0 && handlerKind === 'identifier') {
    // Short form: `(click)="handler($event)"`
    attrValue = `${handlerRef}($event)`;
  } else if (inlineGuards.length === 0 && handlerKind === 'statement') {
    // Statement-form handler — splice as-is (e.g., `closeOnBackdrop && close()`).
    attrValue = handlerRef;
  } else if (inlineGuards.length === 0 && handlerKind === 'callable') {
    // Callable but not bare identifier — invoke with $event.
    attrValue = `(${handlerRef})($event)`;
  } else {
    // Inline guards present — synthesize a class-body wrapped method.
    // For Angular template-event context, the cleanest approach is to inline
    // the guards into a parenthesized $event handler chain. Angular templates
    // don't support multi-statement bodies inline well, so we synthesize a
    // class-body wrapper method via scriptInjection. For v1 simplicity, we
    // splice the guards as a comma-sequence:
    //   (event)="(<guard1>; <guard2>; handler($event))"
    // Angular allows comma-separated statement chains in event bindings as of v17.
    const guardChain = inlineGuards.map((g) => g.replace(/;\s*$/, '')).join('; ');
    let invocation: string;
    if (handlerKind === 'identifier') {
      invocation = `${handlerRef}($event)`;
    } else if (handlerKind === 'callable') {
      invocation = `(${handlerRef})($event)`;
    } else {
      invocation = handlerRef;
    }
    // Angular event bindings support semicolon-separated statements when
    // wrapped in `(...)`; the convention is `(stmt1; stmt2)`. Use chain form.
    // To make this resilient we re-route: use a parenthesized comma form
    // `(_ = (guard ? null : (handler($event))))` is brittle. Use a simpler
    // approach: convert each `if (...) return;` guard to a ternary + early
    // exit via a helper class field. v1 simplification: emit a class-body
    // wrapper method that runs the guards then the handler.
    // Wrapper-method approach:
    const wrapperName = makeWrapperMethodName(handlerRef, counter);
    const e = '$event';
    const guardLines = inlineGuards.map((g) => `    ${g}`).join('\n');
    const innerInvocation =
      handlerKind === 'identifier'
        ? `this.${handlerRef}(${e})`
        : handlerKind === 'callable'
        ? `(${handlerRef})(${e})`
        : handlerRef;
    const decl = [
      `private ${wrapperName} = (${e}: any) => {`,
      guardLines,
      `    ${innerInvocation};`,
      `};`,
    ].join('\n');
    scriptInjection = { name: wrapperName, decl };
    attrValue = `${wrapperName}(${e})`;
    void invocation;
    void guardChain;
  }

  const eventAttr = `(${eventName})="${attrValue}"`;

  const result: EmitTemplateEventResult = { eventAttr, diagnostics };
  if (scriptInjection) {
    result.scriptInjection = scriptInjection;
  }
  return result;
}

/** Compose a stable wrapper-method name for guarded event handlers. */
function makeWrapperMethodName(handlerRef: string, counter: { next: number }): string {
  const baseMatch = handlerRef.match(/^[a-zA-Z_$][\w$]*$/);
  const base = baseMatch ? handlerRef : `handler${counter.next}`;
  const cap = base.charAt(0).toUpperCase() + base.slice(1);
  const N = counter.next++;
  return N === 0 ? `_guarded${cap}` : `_guarded${cap}_${N}`;
}
