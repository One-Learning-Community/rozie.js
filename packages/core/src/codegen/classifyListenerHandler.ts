/**
 * quick 260929-mn8 (DD-8) — the shared `<listeners>` handler-shape classifier.
 *
 * Cross-target contract (identical on React / Vue / Svelte / Angular / Solid /
 * Lit, for every listener class — plain, `.outside(...)`, and
 * `.debounce(...)` / `.throttle(...)`):
 *
 *   - `'callable'` — a method name (`onKey`), a member reference
 *     (`handlers.onKey`, `handlers?.onKey`), or a function expression
 *     (`(e) => onKey(e)`, `function (e) { … }`). The emitter INVOKES it with
 *     the DOM event, so a method-ref handler can read `event.target` /
 *     `event.composedPath()` on every target.
 *   - `'statement'` — anything else (`onKey($event)`, `$data.open = false`,
 *     `a && b()`, `x++`, …). The emitter runs it AS A STATEMENT inside a
 *     function where `$event` is bound. It is never called as a function
 *     (`(stmt)($event)` → TypeError) and never evaluated eagerly at setup
 *     (`throttle(stmt, 50)` → ReferenceError on `$event`).
 *
 * This is the Lit Phase-07.1 WR-03 `isHandlerLike` contract
 * (packages/targets/lit/src/emit/emitListeners.ts), extended with
 * OptionalMemberExpression, hoisted here so all six emitters share ONE
 * non-drifting source. Classify the IR handler AST (`listener.handler`), never
 * a regex over rewritten code.
 *
 * Parenthesized and TS cast wrappers (`(onKey)`, `onKey as Handler`,
 * `onKey!`) are seen through — the runtime value is what decides the shape.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import { unwrapTsCast } from '../ast/unwrapTsCast.js';

export type ListenerHandlerShape = 'callable' | 'statement';

export function classifyListenerHandler(expr: t.Expression): ListenerHandlerShape {
  let current: t.Expression = expr;
  // Peel parenthesized + TS cast wrappers (in any interleaving).
  for (;;) {
    if (t.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    const unwrapped = unwrapTsCast(current);
    if (unwrapped !== current) {
      current = unwrapped;
      continue;
    }
    break;
  }
  if (
    t.isIdentifier(current) ||
    t.isArrowFunctionExpression(current) ||
    t.isFunctionExpression(current) ||
    t.isMemberExpression(current) ||
    t.isOptionalMemberExpression(current)
  ) {
    return 'callable';
  }
  return 'statement';
}
