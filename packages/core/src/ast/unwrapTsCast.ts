/**
 * ROZ132 cast-blindness fix — shared TS wrapper unwrap/rewrap helpers.
 *
 * `const x = $inject('key')` must be bound to a bare `const` — but a
 * design-system author routinely types the injected value through a TS
 * wrapper: `const theme = $inject('theme') as ThemeContext`,
 * `$inject('theme')!`, `$inject('theme') satisfies ThemeContext`, or the
 * legacy angle-cast `<ThemeContext>$inject('theme')`. The value IS still
 * bound to the const in every one of these shapes; only the literal AST node
 * sitting in `declarator.init` differs (a `TS*Expression` wrapping the real
 * `CallExpression`, not the call itself).
 *
 * Both the collector (`collectScriptDecls.ts`) and every per-target emitter's
 * duplicate "is this declarator an `$inject(...)` binder?" detection need to
 * see THROUGH these wrappers to find the underlying call — and the emitters
 * additionally need to re-apply the exact same wrapper text around the
 * target's own runtime read so the author's type survives into the emitted
 * output (never silently downgrading `theme` to an untyped/`any` binding).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';

type TsCastWrapperNode =
  | t.TSAsExpression
  | t.TSNonNullExpression
  | t.TSSatisfiesExpression
  | t.TSTypeAssertion;

/**
 * True when `node` is one of the four TS wrapper shapes this module sees
 * through: `expr as T`, `expr!`, `expr satisfies T`, `<T>expr`.
 */
export function isTsCastWrapper(node: t.Node): node is TsCastWrapperNode {
  return (
    t.isTSAsExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSTypeAssertion(node)
  );
}

/**
 * Peel `TSAsExpression` / `TSNonNullExpression` / `TSSatisfiesExpression` /
 * `TSTypeAssertion` wrappers — recursively, so a chained cast (`x as A as B`)
 * fully unwraps — to reach the underlying runtime expression. Returns `expr`
 * unchanged when it carries no such wrapper.
 */
export function unwrapTsCast(expr: t.Expression): t.Expression {
  let current: t.Expression = expr;
  while (isTsCastWrapper(current)) {
    current = current.expression;
  }
  return current;
}

/**
 * Compute the literal source text needed to re-apply the ORIGINAL TS wrapper
 * chain found on `expr` around a freshly-emitted inner expression's source
 * text. Returns `{ prefix: '', suffix: '' }` when `expr` carries no wrapper
 * (the common case — every existing non-cast `$inject` fixture stays
 * byte-identical).
 *
 * Each layer parenthesizes its operand so the reconstructed text is
 * syntactically safe regardless of what the inner text contains (notably a
 * `??` fallback expression, which cannot be a bare `as`/`satisfies` operand
 * without parens): `(<inner>) as T`, `(<inner>)!`, `(<inner>) satisfies T`,
 * `(<T>(<inner>))`. Nested wrappers compose outside-in, matching the
 * author's original nesting (`x as A as B` reconstructs as `(<inner> as A) as B`).
 *
 * @param genType renders a TS type-annotation node to source text — pass the
 *   caller's local `genCode`/@babel/generator wrapper (TS type nodes print
 *   verbatim, same as the author-annotation passthrough used elsewhere in
 *   the emitters).
 */
export function computeTsCastWrapText(
  expr: t.Expression,
  genType: (node: t.Node) => string,
): { prefix: string; suffix: string } {
  if (t.isTSAsExpression(expr)) {
    const inner = computeTsCastWrapText(expr.expression, genType);
    return {
      prefix: `(${inner.prefix}`,
      suffix: `${inner.suffix}) as ${genType(expr.typeAnnotation)}`,
    };
  }
  if (t.isTSSatisfiesExpression(expr)) {
    const inner = computeTsCastWrapText(expr.expression, genType);
    return {
      prefix: `(${inner.prefix}`,
      suffix: `${inner.suffix}) satisfies ${genType(expr.typeAnnotation)}`,
    };
  }
  if (t.isTSNonNullExpression(expr)) {
    const inner = computeTsCastWrapText(expr.expression, genType);
    return { prefix: `(${inner.prefix}`, suffix: `${inner.suffix})!` };
  }
  if (t.isTSTypeAssertion(expr)) {
    const inner = computeTsCastWrapText(expr.expression, genType);
    return {
      prefix: `(<${genType(expr.typeAnnotation)}>${inner.prefix}`,
      suffix: `${inner.suffix})`,
    };
  }
  return { prefix: '', suffix: '' };
}
