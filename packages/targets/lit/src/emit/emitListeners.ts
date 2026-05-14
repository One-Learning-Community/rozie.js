/**
 * emitListeners — Lit target (Plan 06.4-02 Task 1).
 *
 * Walks IR.listeners and emits per-listener wiring inside firstUpdated() body
 * with cleanup pushed to this._disconnectCleanups (drained by orchestrator's
 * disconnectedCallback).
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
import type { ModifierRegistry } from '../../../../core/src/modifiers/ModifierRegistry.js';
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

function classifyListener(listener: Listener): {
  klass: 'A' | 'B' | 'C' | 'D';
  outsideRefs?: string[] | undefined;
  wrapper?: 'debounce' | 'throttle' | undefined;
  wrapperArgs?: number | undefined;
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
  let outsideRefs: string[] | undefined;
  let wrapper: 'debounce' | 'throttle' | undefined;
  let wrapperArgs: number | undefined;

  for (const entry of listener.modifierPipeline) {
    if (entry.kind === 'listenerOption') {
      if (entry.option === 'capture') listenerOptions.capture = true;
      if (entry.option === 'passive') listenerOptions.passive = true;
      if (entry.option === 'once') listenerOptions.once = true;
      continue;
    }

    if (entry.kind === 'wrap') {
      if (entry.modifier === 'outside') {
        klass = 'B';
        // Extract ref names from args. ModifierArg has shape with `.value` or expression.
        outsideRefs = (entry.args ?? [])
          .map((arg) => extractRefName(arg))
          .filter((s): s is string => s !== null);
      } else if (entry.modifier === 'debounce' || entry.modifier === 'throttle') {
        klass = 'C';
        wrapper = entry.modifier;
        wrapperArgs = extractNumberArg(entry.args);
      }
      continue;
    }

    if (entry.kind === 'filter') {
      if (klass === 'A') klass = 'D';
      // Inline filter guards
      if (entry.modifier === 'stop') inlineGuards.push('e.stopPropagation();');
      else if (entry.modifier === 'prevent') inlineGuards.push('e.preventDefault();');
      else if (entry.modifier === 'self')
        inlineGuards.push('if (e.target !== e.currentTarget) return;');
      else if (entry.modifier === 'enter')
        inlineGuards.push("if ((e as KeyboardEvent).key !== 'Enter') return;");
      else if (entry.modifier === 'escape' || entry.modifier === 'esc')
        inlineGuards.push("if ((e as KeyboardEvent).key !== 'Escape') return;");
      else if (entry.modifier === 'tab')
        inlineGuards.push("if ((e as KeyboardEvent).key !== 'Tab') return;");
    }
  }

  return { klass, outsideRefs, wrapper, wrapperArgs, inlineGuards, listenerOptions };
}

function extractRefName(arg: unknown): string | null {
  // ModifierArg shape from packages/core/src/modifier-grammar/parseModifierChain.ts:
  //   { kind: 'refExpr', ref: string, loc: SourceLoc }
  //   { kind: 'literal', value: ..., loc: SourceLoc }
  if (typeof arg === 'object' && arg !== null) {
    const a = arg as Record<string, unknown>;
    if (a.kind === 'refExpr' && typeof a.ref === 'string') {
      return a.ref as string;
    }
  }
  return null;
}

function extractNumberArg(args: unknown[] | undefined): number {
  if (!args || args.length === 0) return 0;
  const first = args[0];
  if (typeof first === 'object' && first !== null) {
    const a = first as Record<string, unknown>;
    // ModifierArg literal shape: { kind: 'literal', value: number | string | boolean }
    if (a.kind === 'literal') {
      if (typeof a.value === 'number') return a.value as number;
      if (typeof a.value === 'string') {
        const n = Number(a.value);
        return Number.isFinite(n) ? n : 0;
      }
    }
  }
  return 0;
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
  index: number,
): string {
  const cls = classifyListener(listener);
  const handlerExpr = rewriteTemplateExpression(listener.handler, ir);
  const whenExpr = listener.when ? rewriteTemplateExpression(listener.when, ir) : null;

  // Build core handler body: maybe wrap in `when` guard + inline guards.
  const guardLines: string[] = [];
  if (whenExpr) guardLines.push(`if (!(${whenExpr})) return;`);
  guardLines.push(...cls.inlineGuards);

  // WR-03 fix: use AST-based detection to distinguish function-like handlers
  // from inline expressions. Inline expressions (e.g. `count++`) must be
  // emitted as statements (`count++;`) not calls (`(count++)(e)` — TypeError).
  const isFnLike = isHandlerLike(listener.handler);
  const userCall = isFnLike ? `(${handlerExpr})(e);` : `${handlerExpr};`;
  const handlerBody = `(e: Event) => { ${guardLines.join(' ')} ${userCall} }`;

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
      const refs = (cls.outsideRefs ?? []).map(
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
      const ms = cls.wrapperArgs ?? 100;
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
  _modifierRegistry?: ModifierRegistry,
): EmitListenersResult {
  const diagnostics: Diagnostic[] = [];
  const lines: string[] = [];
  let index = 0;
  for (const listener of ir.listeners ?? []) {
    if (listener.source !== 'listeners-block') continue;
    lines.push(emitOneListener(listener, ir, opts, index));
    index++;
  }
  return { firstUpdatedBody: lines.join('\n\n'), diagnostics };
}
