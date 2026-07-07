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
} from '@rozie/core';
import { isEventModifier } from '@rozie/core';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { sanitizeEventName } from '../rewrite/sanitizeEventName.js';

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
  /**
   * Phase 23 — Task 1: the single CVA model prop name (or null). Threaded into
   * the handler `rewriteTemplateExpression` call so an inline model write
   * (`@input="$model.value = x"`) also emits `__rozieCvaOnChange(<newValue>)`.
   */
  cvaModelProp?: string | null | undefined;
  cvaMergeDisabled?: boolean | undefined;
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

/**
 * angular-stop-handler-in-loop — classify an inlineGuard `code` fragment.
 *
 * Every builtin Angular inlineGuard is exactly one of two shapes:
 *   - side-effect statement, e.g. `$event.stopPropagation();` / `$event.preventDefault();`
 *     (`.stop`, `.prevent`) — a plain expression-statement with no control flow.
 *   - early-return guard, e.g. `if ($event.key !== 'Enter') return;`
 *     (`.self`, key/button filters) — a conditional `return`.
 *
 * Angular event bindings are STATEMENTS that support `;`-separated chains, so a
 * pipeline of side-effect-only guards can be emitted INLINE in the `(event)=`
 * template binding (template scope auto-resolves bare component members against
 * `this` AND sees `@for` loop variables). An early-return guard cannot be
 * expressed as a template statement (`if`/`return` is not valid Angular
 * template-statement grammar) — it must stay hoisted into a class-field arrow.
 */
function classifyGuard(code: string): 'sideEffect' | 'earlyReturn' {
  const trimmed = code.trim();
  // `if (...) return;` — the only early-return shape the builtins emit.
  if (/^if\s*\(/.test(trimmed) && /\breturn\b/.test(trimmed)) {
    return 'earlyReturn';
  }
  return 'sideEffect';
}

/**
 * angular-stop-handler-in-loop — collect the names of TOP-LEVEL `<script>`
 * bindings (user `const`/`let`/`function`/`class` declarations) that
 * emitScript.ts lifts into class fields/methods. These ARE class members and so
 * need a `this.` prefix when referenced inside a hoisted guard wrapper arrow —
 * but `applyThisPrefixing`'s member set only covers props/state/computed/refs/
 * emits/collision-renames, so a non-colliding top-level user handler (e.g.
 * `const onPick = () => {}`) was previously left bare → `ReferenceError`.
 */
function collectTopLevelScriptBindings(
  ir: import('../../../../core/src/ir/types.js').IRComponent,
): Set<string> {
  const names = new Set<string>();
  const program = ir.setupBody?.scriptProgram;
  const body = program?.program?.body;
  if (!body) return names;
  for (const stmt of body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        if (t.isIdentifier(d.id)) names.add(d.id.name);
      }
    } else if (t.isFunctionDeclaration(stmt) && stmt.id) {
      names.add(stmt.id.name);
    }
  }
  return names;
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
    cvaModelProp: ctx.cvaModelProp,
    cvaMergeDisabled: ctx.cvaMergeDisabled,
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
    // Phase 12 / D-01 — narrow the discriminated `ModifierImpl` union to the
    // event-shaped variant before touching the event-only `angular()` hook.
    if (!impl || !isEventModifier(impl) || !impl.angular) {
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
        cvaModelProp: ctx.cvaModelProp,
        cvaMergeDisabled: ctx.cvaMergeDisabled,
        // Spike-012 R4 — this handler is spliced into a class-field IIFE (real
        // TS), NOT the template string: keep a TS `as` cast intact (Angular's
        // `$any()` template built-in is undefined in TS code).
        scriptContext: true,
      });
      // Inside the field initializer, the handler-call references `this.X`
      // class members. Rewrite the original handler code through a "this-prefix"
      // pass — for v1 we pass it verbatim because the only handlers exercised
      // are bare identifiers (e.g., onSearch) which need `this.onSearch`.
      // For Counter/SearchInput/Modal/TodoList/Dropdown the IIFE wraps a
      // user-method identifier, so we need `this.${origHandlerCode}` if it's
      // bare. For Dropdown's `reposition` etc., this is the case.
      //
      // Spike-012 NEW-2 — a statement-kind handler (`@input.debounce(300)="bump()"`)
      // is a CallExpression, not a function reference: the IIFE would invoke it
      // (`(bump() as …)(...args)`) and pass its `void` result, with `bump` left
      // un-`this`-qualified (a free identifier). Wrap it in a `this`-prefixed
      // thunk so the IIFE debounces the FUNCTION, matching the plain-event path.
      let wrappedHandlerCode: string;
      if (classifyHandler(listener.handler) === 'statement') {
        const topLevelBindings = collectTopLevelScriptBindings(ctx.ir);
        const prefixed = applyThisPrefixing(
          origHandlerCode,
          ctx.ir,
          ctx.collisionRenames,
          topLevelBindings,
        );
        // Parenthesize the arrow: the IIFE splices this as `(${code} as
        // (...a: any[]) => any)`, and `(arrow as T)` without the inner parens is
        // a parse ambiguity (`((arrow) as T)` is required).
        wrappedHandlerCode = `(($event: any) => { ${prefixed}; })`;
      } else {
        // Spike-012 R3-3 — a callable (non-statement) handler that is not a bare
        // identifier — e.g. `@input.debounce="$props.onPick"` → `onPick()` — must
        // also be `this`-qualified, or the IIFE references a free `onPick`.
        // `applyThisPrefixing` covers props/state/methods/top-level bindings, so
        // it handles both the bare-method form (`onSearch` → `this.onSearch`,
        // byte-identical to the old regex) and the member/call form.
        wrappedHandlerCode = applyThisPrefixing(
          origHandlerCode,
          ctx.ir,
          ctx.collisionRenames,
          collectTopLevelScriptBindings(ctx.ir),
        );
      }
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
    // Short form: `(click)="handler($event)"`.
    // Quick task 260520-w18 bug class 6(i) — when the bound handler is a
    // 0-arg user method/arrow (e.g. TipTap's `toggleBold = () => …`),
    // passing `$event` is a strictTemplates TS2554 (expected 0, got 1).
    // Look up the original user handler's arity and drop `$event` for
    // 0-arg handlers. Debounce/throttle wrap names also have
    // `handlerKind: 'identifier'` but their original `listener.handler` is
    // not a bare Identifier, so `originalName` is undefined and the arg is
    // kept (the IIFE wrapper takes `...args`).
    const originalName = t.isIdentifier(listener.handler)
      ? listener.handler.name
      : undefined;
    const arity =
      originalName !== undefined
        ? ctx.handlerArity?.get(originalName)
        : undefined;
    attrValue = arity === 0 ? `${handlerRef}()` : `${handlerRef}($event)`;
  } else if (inlineGuards.length === 0 && handlerKind === 'statement') {
    // Statement-form handler — splice as-is (e.g., `closeOnBackdrop && close()`).
    attrValue = handlerRef;
  } else if (inlineGuards.length === 0 && handlerKind === 'callable') {
    // Callable but not bare identifier — invoke with $event.
    attrValue = `(${handlerRef})($event)`;
  } else if (inlineGuards.every((g) => classifyGuard(g) === 'sideEffect')) {
    // angular-stop-handler-in-loop — ALL guards are plain side-effect
    // statements (`.stop` → `$event.stopPropagation();`, `.prevent` →
    // `$event.preventDefault();`). Angular event bindings are STATEMENTS that
    // support `;`-separated chains, so emit the guards INLINE in the `(event)=`
    // template binding rather than hoisting a class-field arrow wrapper. The
    // inline form runs in TEMPLATE scope:
    //   - bare component members auto-resolve against `this`
    //     (no fragile regex `this.`-prefixing — fixes the non-colliding
    //      top-level user handler `onPick is not defined` bug), and
    //   - `@for` loop variables (`header`) are visible
    //     (a class-field arrow cannot capture them — the core of the bug), and
    //   - no `this.undefined($event)` is ever synthesized (no wrapper at all).
    //
    // Each guard string already ends with `;`. The template-scope handler
    // invocation is appended as the final statement in the chain.
    const guardChain = inlineGuards.join(' ');
    let invocation: string;
    if (handlerKind === 'identifier') {
      const originalName = t.isIdentifier(listener.handler)
        ? listener.handler.name
        : undefined;
      const arity =
        originalName !== undefined
          ? ctx.handlerArity?.get(originalName)
          : undefined;
      invocation = arity === 0 ? `${handlerRef}()` : `${handlerRef}($event)`;
    } else if (handlerKind === 'callable') {
      invocation = `(${handlerRef})($event)`;
    } else {
      // statement — splice the template-scope expression as-is.
      invocation = handlerRef;
    }
    attrValue = `${guardChain} ${invocation}`;
  } else {
    // At least one early-return guard (`.self` / a key/button filter →
    // `if (C) return;`). Angular template-statement grammar has no `if`/`return`
    // form, so these MUST be hoisted into a class-body wrapper arrow that runs
    // the guards then invokes the handler. The wrapper body runs in CLASS scope:
    //   - class-member references need an explicit `this.` prefix, and
    //   - a `@for` loop variable is NOT in scope — a class-field arrow cannot
    //     capture it. We emit a diagnostic (ROZ723) for that residual rather
    //     than silently emitting an undefined reference.
    //
    // `applyThisPrefixing` post-processes the template-style `handlerRef` so
    // bare class-member identifiers (signal calls + user methods + collision
    // renames + TOP-LEVEL user `<script>` bindings) get a `this.` prefix.
    const wrapperName = makeWrapperMethodName(handlerRef, counter);
    const guardLines = inlineGuards.map((g) => `  ${g}`).join('\n');

    // angular-stop-handler-in-loop — a hoisted early-return guard whose handler
    // references a loop-scoped binding cannot work: the class-field arrow runs
    // outside the `@for` template scope. Flag it (ROZ723) so the failure is a
    // compile diagnostic, not a silent runtime `ReferenceError`.
    if (ctx.loopBindings && ctx.loopBindings.size > 0) {
      const referencedLoopVar = Array.from(ctx.loopBindings).find((name) =>
        new RegExp(`(?<![\\w$.])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(
          handlerRef,
        ),
      );
      if (referencedLoopVar !== undefined) {
        diagnostics.push({
          code: RozieErrorCode.TARGET_ANGULAR_LOOP_GUARD_HOIST, // ROZ723
          severity: 'error',
          message: `Event handler uses an early-return modifier (e.g. '.self' or a key filter) inside an r-for loop and references the loop variable '${referencedLoopVar}'. Angular hoists this guard to a class-field arrow that cannot capture loop-scoped bindings. Move the guard check into the handler body, or use a side-effect-only modifier (.stop / .prevent) which Angular can emit inline.`,
          loc: listener.sourceLoc,
        });
      }
    }

    // angular-stop-handler-in-loop — include TOP-LEVEL `<script>` bindings in
    // the member set so a non-colliding user handler (`const onBare = () => {}`,
    // lifted to a class field) is correctly `this.`-prefixed inside the wrapper.
    const topLevelBindings = collectTopLevelScriptBindings(ctx.ir);
    const thisPrefixed = applyThisPrefixing(
      handlerRef,
      ctx.ir,
      ctx.collisionRenames,
      topLevelBindings,
    );

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
      // The bare handlerRef may be a top-level user fn (not in the old member
      // set) — `thisPrefixed` already routed it through `this.`; use it as the
      // callee so a non-colliding `onBare` becomes `this.onBare`.
      innerInvocation =
        arity === 0 ? `${thisPrefixed}()` : `${thisPrefixed}($event)`;
    } else if (handlerKind === 'callable') {
      innerInvocation = `(${thisPrefixed})($event)`;
    } else {
      // statement — splice as-is with `this.` prefixing.
      innerInvocation = thisPrefixed;
    }
    const decl = [
      `private ${wrapperName} = ($event: any) => {`,
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
  extraMembers?: ReadonlySet<string> | undefined,
): string {
  const memberNames = new Set<string>();
  for (const p of ir.props) memberNames.add(p.name);
  for (const s of ir.state) memberNames.add(s.name);
  for (const c of ir.computed) memberNames.add(c.name);
  for (const r of ir.refs) memberNames.add(r.name);
  // Bug 2 (260520-gi1): the output() field id is the sanitized
  // (valid-identifier) name — the member-name set must hold the sanitized
  // form so `applyThisPrefixing` matches the real field.
  for (const e of ir.emits) memberNames.add(sanitizeEventName(e));
  // Add collision-renamed targets (e.g., _close).
  if (collisionRenames) {
    for (const renamed of collisionRenames.values()) memberNames.add(renamed);
  }
  // angular-stop-handler-in-loop — TOP-LEVEL `<script>` bindings (lifted to
  // class fields/methods) so a non-colliding user handler is `this.`-prefixed.
  if (extraMembers) {
    for (const name of extraMembers) memberNames.add(name);
  }
  // Spike-012 R5 (C3b) — the CVA view→model bridge callback is a private class
  // field. A model-prop write lowered into a `.debounce`/`.throttle` class-field
  // IIFE (scriptContext) emits a bare `__rozieCvaOnChange(...)` (correct in a
  // template, which resolves against `this`, but a FREE ident in the field). It
  // only appears in the code string when a CVA model write was lowered, so
  // adding it unconditionally is a no-op otherwise (unique name, no false match).
  memberNames.add('__rozieCvaOnChange');

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
