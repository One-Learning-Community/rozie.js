/**
 * emitListeners — Lit target (Plan 06.4-02 Task 1; Plan 07.1-02 registry rewrite).
 *
 * Walks IR.listeners and emits per-listener wiring inside firstUpdated() body
 * with cleanup pushed to this._disconnectCleanups (drained by orchestrator's
 * disconnectedCallback).
 *
 * Modifier classification is registry-driven (Plan 07.1-02): each pipeline
 * entry is resolved via `registry.get(entry.modifier).lit(...)` into a
 * `LitEmissionDescriptor` (native / inlineGuard / helper), mirroring the
 * Svelte/Angular reference dispatch. The previous hand-rolled
 * `switch (entry.modifier)` ladder is gone — this is what lets third-party
 * modifiers target Lit.
 *
 * 4-class listener classifier (preserved from Solid):
 *   A — pure native (no .outside, no .debounce/.throttle) — addEventListener wiring.
 *   B — .outside collapse — `attachOutsideClickListener(refs, handler, when)` helper.
 *   C — .debounce/.throttle — inline IIFE wrapping the user body.
 *   D — pure inlineGuard — same as A with prelude guards.
 *
 * Outside-click uses runtime helper `attachOutsideClickListener` (Claude's
 * Discretion consolidation): it walks `e.composedPath()` (NOT `target.contains`)
 * so refs inside shadow boundaries are correctly detected.
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  Listener,
  ListenerTarget,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type {
  LitImportCollector,
  LitDecoratorImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';
import type { ModifierRegistry, LitEmissionDescriptor } from '@rozie/core';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import * as bt from '@babel/types';

export interface EmitListenersOpts {
  decorators: LitDecoratorImportCollector;
  runtime: RuntimeLitImportCollector;
  lit: LitImportCollector;
}

export interface EmitListenersResult {
  /** Statements to splice into firstUpdated(). */
  firstUpdatedBody: string;
  diagnostics: Diagnostic[];
}

function targetExpression(target: ListenerTarget): string {
  if (target.kind === 'global') {
    return target.name; // 'document' | 'window'
  }
  if (target.kind === 'self') {
    return 'this';
  }
  // ref target
  return `this._ref${target.refName.charAt(0).toUpperCase()}${target.refName.slice(1)}`;
}

interface ClassifyOpts {
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
}

/**
 * Classify a listener's modifier pipeline via registry dispatch.
 *
 * For each entry: resolve `impl.lit(args, ctx)` → `LitEmissionDescriptor`,
 * then fold the descriptor into the classifier state:
 *   - `native`     → addEventListener option flag
 *   - `inlineGuard`→ prelude guard string
 *   - `helper`     → `attachOutsideClickListener` selects Class B;
 *                    `debounce` / `throttle` select Class C
 */
function classifyListener(
  listener: Listener,
  opts: ClassifyOpts,
): {
  klass: 'A' | 'B' | 'C' | 'D';
  outsideArgs?: ModifierArg[] | undefined;
  wrapper?: 'debounce' | 'throttle' | undefined;
  wrapperArgs?: ModifierArg[] | undefined;
  inlineGuards: string[];
  listenerOptions: { capture?: boolean; passive?: boolean; once?: boolean };
} {
  const inlineGuards: string[] = [];
  const listenerOptions: {
    capture?: boolean;
    passive?: boolean;
    once?: boolean;
  } = {};
  let klass: 'A' | 'B' | 'C' | 'D' = 'A';
  let outsideArgs: ModifierArg[] | undefined;
  let wrapper: 'debounce' | 'throttle' | undefined;
  let wrapperArgs: ModifierArg[] | undefined;

  for (const entry of listener.modifierPipeline) {
    if (entry.kind === 'listenerOption') {
      if (entry.option === 'capture') listenerOptions.capture = true;
      if (entry.option === 'passive') listenerOptions.passive = true;
      if (entry.option === 'once') listenerOptions.once = true;
      continue;
    }

    const impl = opts.registry.get(entry.modifier);
    if (!impl || !impl.lit) {
      opts.diagnostics.push({
        code: RozieErrorCode.TARGET_LIT_RESERVED,
        severity: 'error',
        message: `Modifier '.${entry.modifier}' has no Lit emitter (missing lit() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }
    const descriptor: LitEmissionDescriptor = impl.lit(entry.args, {
      source: 'listeners-block',
      event: listener.event,
      sourceLoc: entry.sourceLoc,
    });

    if (descriptor.kind === 'native') {
      if (descriptor.token === 'capture') listenerOptions.capture = true;
      if (descriptor.token === 'passive') listenerOptions.passive = true;
      if (descriptor.token === 'once') listenerOptions.once = true;
      continue;
    }
    if (descriptor.kind === 'inlineGuard') {
      if (klass === 'A') klass = 'D';
      inlineGuards.push(descriptor.code);
      continue;
    }
    // descriptor.kind === 'helper'
    if (descriptor.helperName === 'attachOutsideClickListener') {
      klass = 'B';
      outsideArgs = descriptor.args;
      continue;
    }
    if (descriptor.helperName === 'debounce' || descriptor.helperName === 'throttle') {
      klass = 'C';
      wrapper = descriptor.helperName;
      wrapperArgs = descriptor.args;
      continue;
    }
  }

  return { klass, outsideArgs, wrapper, wrapperArgs, inlineGuards, listenerOptions };
}

function extractRefName(arg: ModifierArg): string | null {
  // ModifierArg shape from packages/core/src/modifier-grammar/parseModifierChain.ts:
  //   { kind: 'refExpr', ref: string, loc: SourceLoc }
  //   { kind: 'literal', value: ..., loc: SourceLoc }
  if (arg.kind === 'refExpr' && typeof arg.ref === 'string') {
    return arg.ref;
  }
  return null;
}

function extractNumberArg(args: ModifierArg[] | undefined): number {
  if (!args || args.length === 0) return 0;
  const first = args[0];
  if (first && first.kind === 'literal') {
    if (typeof first.value === 'number') return first.value;
    if (typeof first.value === 'string') {
      const n = Number(first.value);
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

/**
 * Map a DOM event name to the matching DOM event interface so registry-driven
 * inlineGuards (e.g. `if (e.key !== 'Escape') return;`) typecheck against the
 * handler parameter without a per-guard `(e as KeyboardEvent)` cast. Mirrors
 * the Svelte target's `eventTypeFor`.
 */
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
  if (
    event === 'touchstart' ||
    event === 'touchend' ||
    event === 'touchmove' ||
    event === 'touchcancel'
  )
    return 'TouchEvent';
  if (
    event === 'pointerdown' ||
    event === 'pointerup' ||
    event === 'pointermove' ||
    event === 'pointercancel'
  )
    return 'PointerEvent';
  if (event === 'focus' || event === 'blur') return 'FocusEvent';
  if (event === 'input') return 'InputEvent';
  if (event === 'submit') return 'SubmitEvent';
  return 'Event';
}

/**
 * WR-03 fix: mirror emitTemplate.ts's AST-based isHandlerLike check.
 * Arrow functions and function expressions passed by reference are function-like
 * and can be called as `(handler)(e)`. Inline expressions (count++, etc.)
 * must be emitted as statement form `handler;` without the call wrapper.
 */
function isHandlerLike(expr: bt.Expression): boolean {
  if (bt.isArrowFunctionExpression(expr)) return true;
  if (bt.isFunctionExpression(expr)) return true;
  if (bt.isIdentifier(expr)) return true;
  if (bt.isMemberExpression(expr)) return true; // `this.fn`
  return false;
}

function emitOneListener(
  listener: Listener,
  ir: IRComponent,
  opts: EmitListenersOpts,
  registry: ModifierRegistry,
  diagnostics: Diagnostic[],
  index: number,
): string {
  const cls = classifyListener(listener, { registry, diagnostics });
  const handlerExpr = rewriteTemplateExpression(listener.handler, ir);
  const whenExpr = listener.when ? rewriteTemplateExpression(listener.when, ir) : null;
  const evtType = eventTypeFor(listener.event);

  // Build core handler body: maybe wrap in `when` guard + inline guards.
  const guardLines: string[] = [];
  if (whenExpr) guardLines.push(`if (!(${whenExpr})) return;`);
  guardLines.push(...cls.inlineGuards);

  // WR-03 fix: use AST-based detection to distinguish function-like handlers
  // from inline expressions. Inline expressions (e.g. `count++`) must be
  // emitted as statements (`count++;`) not calls (`(count++)(e)` — TypeError).
  const isFnLike = isHandlerLike(listener.handler);
  const userCall = isFnLike ? `(${handlerExpr})(e);` : `${handlerExpr};`;
  const handlerBody = `(e: ${evtType}) => { ${guardLines.join(' ')} ${userCall} }`;

  // Build addEventListener options object (all options are significant for the add call).
  const addOptionFields: string[] = [];
  if (cls.listenerOptions.capture) addOptionFields.push('capture: true');
  if (cls.listenerOptions.passive) addOptionFields.push('passive: true');
  if (cls.listenerOptions.once) addOptionFields.push('once: true');
  const optionsExpr = addOptionFields.length > 0 ? `{ ${addOptionFields.join(', ')} }` : 'undefined';

  // WR-11 fix: removeEventListener only uses the `capture` flag for matching;
  // `passive` and `once` are ignored by the DOM spec in the remove call.
  // For `once: true`-only listeners (no capture), the browser auto-removes after
  // the first fire — no cleanup needed.
  const removeOptionsExpr = cls.listenerOptions.capture ? '{ capture: true }' : 'undefined';
  const skipCleanup = cls.listenerOptions.once && !cls.listenerOptions.capture;

  // WR-04 fix: use section-specific prefix _lh (listener handler) to avoid
  // future collision with other emitter-generated variables in firstUpdated().
  const handlerVar = `_lh${index}`;

  switch (cls.klass) {
    case 'B': {
      // .outside collapse → attachOutsideClickListener
      opts.runtime.add('attachOutsideClickListener');
      const refs = (cls.outsideArgs ?? [])
        .map((arg) => extractRefName(arg))
        .filter((r): r is string => r !== null)
        .map(
          (r) =>
            `() => this._ref${r.charAt(0).toUpperCase()}${r.slice(1)}`,
        );
      const refsArr = `[${refs.join(', ')}]`;
      const whenFn = whenExpr ? `, () => (${whenExpr})` : '';
      const unsubVar = `_u${index}`;
      return [
        `const ${unsubVar} = attachOutsideClickListener(${refsArr}, (e) => { ${cls.inlineGuards.join(' ')} (${handlerExpr})(e); }${whenFn});`,
        `this._disconnectCleanups.push(${unsubVar});`,
      ].join('\n');
    }

    case 'C': {
      // .debounce / .throttle → inline IIFE
      const ms = extractNumberArg(cls.wrapperArgs) || 100;
      const wrapped =
        cls.wrapper === 'debounce'
          ? `(() => { let t: ReturnType<typeof setTimeout> | undefined; return (e: Event) => { ${guardLines.join(' ')} if (t) clearTimeout(t); t = setTimeout(() => { (${handlerExpr})(e); }, ${ms}); }; })()`
          : `(() => { let last = 0; return (e: Event) => { ${guardLines.join(' ')} const now = Date.now(); if (now - last < ${ms}) return; last = now; (${handlerExpr})(e); }; })()`;
      const target = targetExpression(listener.target);
      const lines = [
        `const ${handlerVar} = ${wrapped};`,
        `${target}.addEventListener('${listener.event}', ${handlerVar}, ${optionsExpr});`,
      ];
      if (!skipCleanup) {
        lines.push(`this._disconnectCleanups.push(() => ${target}.removeEventListener('${listener.event}', ${handlerVar}, ${removeOptionsExpr}));`);
      }
      return lines.join('\n');
    }

    case 'A':
    case 'D':
    default: {
      const target = targetExpression(listener.target);
      const lines = [
        `const ${handlerVar} = ${handlerBody};`,
        `${target}.addEventListener('${listener.event}', ${handlerVar}, ${optionsExpr});`,
      ];
      if (!skipCleanup) {
        lines.push(`this._disconnectCleanups.push(() => ${target}.removeEventListener('${listener.event}', ${handlerVar}, ${removeOptionsExpr}));`);
      }
      return lines.join('\n');
    }
  }
}

export function emitListeners(
  ir: IRComponent,
  opts: EmitListenersOpts,
  modifierRegistry: ModifierRegistry,
): EmitListenersResult {
  const diagnostics: Diagnostic[] = [];
  const lines: string[] = [];
  let index = 0;
  for (const listener of ir.listeners ?? []) {
    if (listener.source !== 'listeners-block') continue;
    lines.push(emitOneListener(listener, ir, opts, modifierRegistry, diagnostics, index));
    index++;
  }
  return { firstUpdatedBody: lines.join('\n\n'), diagnostics };
}
