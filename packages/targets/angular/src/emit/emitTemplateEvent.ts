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
  /**
   * Bug 5: handler-name → parameter-count map (from the un-rewritten script
   * Program). Lets guarded-wrapper synthesis decide whether to forward the
   * event arg to a zero-arg handler. Keyed by the ORIGINAL user handler name.
   */
  handlerArity?: ReadonlyMap<string, number> | undefined;
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
    `    timer = setTimeout(() => (${origCode} as (...a: any[]) => any)(...args), ${ms});`,
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
    `    (${origCode} as (...a: any[]) => any)(...args);`,
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
    // Inline guards present — synthesize a class-body wrapper method that
    // runs the guards then invokes the handler. The wrapper body uses `e`
    // as the event arg so that inlineGuard fragments like
    // `if (e.target !== e.currentTarget) return;` resolve naturally.
    //
    // The body's class-member references need `this.` prefix because we're
    // inside a class arrow field, not a template binding. We post-process
    // the rewritten template-style handler code by adding `this.` prefix to
    // bare class-member identifiers (signal calls + user methods + collision
    // renames).
    const wrapperName = makeWrapperMethodName(handlerRef, counter);
    const guardLines = inlineGuards.map((g) => `  ${g}`).join('\n');

    // Re-render the handler with class-member-aware `this.` prefix. Use a
    // simple post-process: any bare identifier matching a known class member
    // gets `this.` prefix. The `handlerRef` was produced by
    // rewriteTemplateExpression in template style.
    const thisPrefixed = applyThisPrefixing(handlerRef, ctx.ir, ctx.collisionRenames);

    let innerInvocation: string;
    if (handlerKind === 'identifier') {
      // handlerRef is bare like `onSearch` (or collision-renamed `_close`).
      // Bug 5: when the target handler is a zero-arg arrow/function, calling
      // it with `e` is TS2554 (expected 0, got 1). Look up the original user
      // handler name in the arity map and drop the arg when arity is 0.
      // Only applies when the handler was an authored Identifier — debounce/
      // throttle wrap names (also `handlerKind: 'identifier'`) take `...args`.
      const originalName = t.isIdentifier(listener.handler)
        ? listener.handler.name
        : undefined;
      const arity =
        originalName !== undefined
          ? ctx.handlerArity?.get(originalName)
          : undefined;
      innerInvocation =
        arity === 0 ? `this.${handlerRef}()` : `this.${handlerRef}(e)`;
    } else if (handlerKind === 'callable') {
      innerInvocation = `(${thisPrefixed})(e)`;
    } else {
      // statement — splice as-is with `this.` prefixing.
      innerInvocation = thisPrefixed;
    }
    const decl = [
      `private ${wrapperName} = (e: any) => {`,
      guardLines,
      `  ${innerInvocation};`,
      `};`,
    ].join('\n');
    scriptInjection = { name: wrapperName, decl };
    attrValue = `${wrapperName}($event)`;
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

/**
 * Apply `this.` prefix to bare references to class members in a string of
 * template-rewritten code. Used when generating class-body field initializers
 * from template expressions (e.g., the body of a guarded event wrapper).
 *
 * Heuristic: we look for word-boundary identifier patterns that match a
 * known class member name AND are NOT already preceded by `.` or `this.`.
 * This is a regex-based pass; it's not 100% precise (won't catch shadowing
 * via let/const inside arrow bodies), but for the v1 reference examples it
 * produces correct output.
 */
function applyThisPrefixing(
  code: string,
  ir: import('../../../../core/src/ir/types.js').IRComponent,
  collisionRenames?: ReadonlyMap<string, string> | undefined,
): string {
  const memberNames = new Set<string>();
  for (const p of ir.props) memberNames.add(p.name);
  for (const s of ir.state) memberNames.add(s.name);
  for (const c of ir.computed) memberNames.add(c.name);
  for (const r of ir.refs) memberNames.add(r.name);
  for (const e of ir.emits) memberNames.add(e);
  // Add collision-renamed targets (e.g., _close).
  if (collisionRenames) {
    for (const renamed of collisionRenames.values()) memberNames.add(renamed);
  }

  if (memberNames.size === 0) return code;

  // Build a regex matching any of the member names as a word-boundary token.
  const pattern = new RegExp(
    `(?<![\\w$.])(${Array.from(memberNames)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})\\b`,
    'g',
  );
  return code.replace(pattern, 'this.$1');
}
