/**
 * emitTemplateEvent — Phase 5 Plan 02a Task 2.
 *
 * Renders a template `@event[.modifier...]="handler"` Listener into a Svelte 5
 * `oneventName={...}` attribute (lowercase, NO `on:` prefix per Pitfall 4).
 *
 * Pitfall 4 enforcement: Svelte 5 dropped BOTH the legacy "on" colon-event
 * syntax AND the pipe-modifier shorthand. Every Rozie modifier in
 * template-event context must inlineGuard inside a synthesized arrow handler:
 *
 *   `@click.stop="handler"`
 *     → `onclick={(e) => { e.stopPropagation(); handler(e); }}`
 *
 * Modifier-descriptor handling (per ModifierImpl.svelte() hook):
 *   - `kind: 'inlineGuard'` — append the guard's `code` before the handler
 *     invocation in a synthesized arrow.
 *   - `kind: 'helper'` with `helperName: 'debounce' | 'throttle'` — emit a
 *     script-level wrapper IIFE via SvelteScriptInjection (`top` position so
 *     the handler reference is in scope when the template renders) and bind
 *     the wrapped name as the event handler.
 *   - `kind: 'helper'` with `listenerOnly: true` (.outside) — ROZ621 (only
 *     valid in <listeners> blocks).
 *   - `kind: 'native'` (capture/passive/once tokens) — REJECTED in template
 *     context with ROZ621. Per RESEARCH Pitfall 4, Svelte 5 has no template-
 *     side native modifier passthrough. These tokens are valid ONLY in the
 *     listeners-block addEventListener options object (Plan 02a Task 3).
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
  SvelteEmissionDescriptor,
} from '@rozie/core';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { SvelteScriptInjection } from './emitScript.js';

export interface EmitEventCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  /** Per-component counter so suffix names are stable + collision-free. */
  injectionCounter?: { next: number };
}

export interface EmitTemplateEventResult {
  /** The emitted attribute string, e.g., `onclick={handler}`. */
  eventAttr: string;
  /** Optional script-level injection (debounce/throttle wrap). */
  scriptInjection?: SvelteScriptInjection;
  diagnostics: Diagnostic[];
}

/** Render a ModifierArg as a JS-source string (literal or refExpr). */
function renderModifierArg(arg: ModifierArg): string {
  if (arg.kind === 'literal') return JSON.stringify(arg.value);
  return arg.ref;
}

/**
 * Compose a stable wrap name for a debounce/throttle handler at script level.
 * Mirrors the Vue side's makeWrapName.
 */
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
 * Inline IIFE for a debounce wrapper. No runtime-svelte import per A8/A9.
 *
 *   const debouncedFoo = (() => {
 *     let timer: ReturnType<typeof setTimeout> | null = null;
 *     return (...args: any[]) => {
 *       if (timer !== null) clearTimeout(timer);
 *       timer = setTimeout(() => orig(...args), 300);
 *     };
 *   })();
 */
function buildDebounceIIFE(wrapName: string, origCode: string, ms: string): string {
  return [
    `const ${wrapName} = (() => {`,
    `  let timer: ReturnType<typeof setTimeout> | null = null;`,
    `  return (...args: any[]) => {`,
    `    if (timer !== null) clearTimeout(timer);`,
    `    timer = setTimeout(() => (${origCode})(...args), ${ms});`,
    `  };`,
    `})();`,
  ].join('\n');
}

/**
 * Inline IIFE for a throttle wrapper. No runtime-svelte import per A8/A9.
 *
 *   const throttledFoo = (() => {
 *     let lastCall = 0;
 *     return (...args: any[]) => {
 *       const now = Date.now();
 *       if (now - lastCall < 100) return;
 *       lastCall = now;
 *       orig(...args);
 *     };
 *   })();
 */
function buildThrottleIIFE(wrapName: string, origCode: string, ms: string): string {
  return [
    `const ${wrapName} = (() => {`,
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

/**
 * Classify the handler shape so we know how to assemble the synthesized arrow.
 *
 *   - 'identifier' — bare ref like `decrement`. Use as a callable; pass `(e)`.
 *   - 'callable'   — invokable expression (CallExpression, ArrowFunction,
 *                    FunctionExpression, MemberExpression that ends in a call,
 *                    LogicalExpression where right side is a call). Treated
 *                    as a statement: emit verbatim inside the arrow body.
 *   - 'statement'  — assignment / sequence / non-callable expression
 *                    (`hovering = true`). Inline as a statement.
 */
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
    // A call like `toggle(item.id)` or `closeOnBackdrop && close()` — it
    // already evaluates the call when the handler fires; treat as a statement.
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
  // Fallback: treat as statement (safer — won't try to invoke a non-callable).
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
  let scriptInjection: SvelteScriptInjection | undefined;
  // Classify the original handler shape BEFORE rewriting (so structural
  // information from the Babel AST is available) — wrap-name substitution
  // forces 'identifier' downstream.
  let handlerKind = classifyHandler(listener.handler);
  let handlerRef: string = rewriteTemplateExpression(listener.handler, ctx.ir);

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
    if (!impl || !impl.svelte) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_SVELTE_RESERVED, // ROZ621
        severity: 'error',
        message: `Modifier '.${modifierName}' has no Svelte emitter (missing svelte() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    const descriptor: SvelteEmissionDescriptor = impl.svelte(modifierArgs, {
      source: 'template-event',
      event: eventName,
      sourceLoc: entry.sourceLoc,
    });

    if (descriptor.kind === 'native') {
      // Pitfall 4: Svelte 5 has no template-side native modifier passthrough.
      // The `native` variant is valid ONLY in listeners-block addEventListener
      // options. Reject in template-event context.
      diagnostics.push({
        code: RozieErrorCode.TARGET_SVELTE_RESERVED, // ROZ621
        severity: 'error',
        message: `Modifier '.${modifierName}' emits a native '${descriptor.token}' option, which Svelte 5 does NOT support on template @event bindings (Pitfall 4 — Svelte 5 dropped the legacy colon-event syntax + pipe-modifier shorthand). Move this modifier to a <listeners> block.`,
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
        code: RozieErrorCode.TARGET_SVELTE_RESERVED, // ROZ621
        severity: 'error',
        message: `Modifier '.${modifierName}' is listenerOnly — only valid in <listeners> blocks, not on template @event bindings.`,
        loc: entry.sourceLoc,
      });
      continue;
    }

    if (descriptor.helperName === 'debounce' || descriptor.helperName === 'throttle') {
      // Per A8/A9: emit an inline IIFE at script-level, NOT an import from
      // `@rozie/runtime-svelte`.
      const wrapName = makeWrapName(descriptor.helperName, listener.handler, counter);
      const argList = descriptor.args.map(renderModifierArg);
      const ms = argList[0] ?? '0';
      const origHandlerCode = rewriteTemplateExpression(listener.handler, ctx.ir);
      const decl =
        descriptor.helperName === 'debounce'
          ? buildDebounceIIFE(wrapName, origHandlerCode, ms)
          : buildThrottleIIFE(wrapName, origHandlerCode, ms);
      scriptInjection = {
        name: wrapName,
        decl,
        // 'bottom' so the wrapper observes the user-declared handler arrow
        // (e.g., `const onSearch = ...`) in scope.
        position: 'bottom',
      };
      handlerRef = wrapName;
      // The wrapper IS a callable identifier — override the original kind.
      handlerKind = 'identifier';
      continue;
    }

    // useOutsideClick on template @event would have been caught by listenerOnly.
    // Defensive fallback.
    diagnostics.push({
      code: RozieErrorCode.TARGET_SVELTE_RESERVED, // ROZ621
      severity: 'error',
      message: `Modifier '.${modifierName}' helper '${descriptor.helperName}' is not supported on template @event bindings.`,
      loc: entry.sourceLoc,
    });
  }

  // Compose the handler attribute. Naming convention: lowercase Svelte 5
  // event-prop name = `on${eventName}`. NO `on:` prefix (Pitfall 4).
  const attrName = `on${eventName.toLowerCase()}`;

  let attrValue: string;
  if (inlineGuards.length === 0 && handlerKind === 'identifier') {
    // Short form: `onclick={handler}`.
    attrValue = handlerRef;
  } else {
    // Synthesize an arrow handler. Body shape depends on handler kind:
    //   - 'identifier'/'callable' — invoke as `handler(e)` so the user's
    //     handler signature receives the DOM event.
    //   - 'statement' — splice as a statement (no `(e)` invocation).
    const guardLines = inlineGuards.join(' ');
    const guardPrefix = guardLines.length > 0 ? `${guardLines} ` : '';
    let body: string;
    if (handlerKind === 'identifier') {
      body = `${handlerRef}(e)`;
    } else if (handlerKind === 'callable') {
      body = `(${handlerRef})(e)`;
    } else {
      // statement — splice verbatim.
      body = handlerRef;
    }
    attrValue = `(e) => { ${guardPrefix}${body}; }`;
  }

  const eventAttr = `${attrName}={${attrValue}}`;

  const result: EmitTemplateEventResult = { eventAttr, diagnostics };
  if (scriptInjection) {
    result.scriptInjection = scriptInjection;
  }
  return result;
}
