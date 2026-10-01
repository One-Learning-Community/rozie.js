/**
 * functionExpressionAsArrow — shared by the class-based targets (Angular, Lit).
 *
 * A top-level `<script>` `const f = function (…) { … }` becomes a CLASS FIELD
 * on Angular and Lit, and its `$data`/`$props` reads are rewritten to `this.…`.
 * Emitted as a `function` expression, that `this` is the call receiver, not
 * the instance: TS2683 (implicit-any `this`) under strict, and `this` is lost
 * when the verb is called detached (a callback, a destructured handle). Every
 * other script function is lifted as an arrow field; this returns the arrow
 * equivalent of `fn`, or `null` when the rewrite would change meaning — a
 * generator, a named function expression (its own name may be referenced
 * inside), or a body that reads `arguments` / `new.target`.
 *
 * @experimental — added in typed-surface P1 (final fix wave)
 */
import * as t from '@babel/types';

function usesOwnFunctionScope(fn: t.FunctionExpression): boolean {
  let found = false;
  const visit = (node: t.Node | null | undefined, nested: boolean): void => {
    if (found || node == null) return;
    if (!nested && t.isIdentifier(node) && node.name === 'arguments') {
      found = true;
      return;
    }
    if (!nested && t.isMetaProperty(node) && node.meta.name === 'new') {
      found = true;
      return;
    }
    const keys = t.VISITOR_KEYS[node.type] ?? [];
    // A nested non-arrow function has its own `arguments` / `new.target`.
    const inner = nested || t.isFunctionExpression(node) || t.isFunctionDeclaration(node) || t.isObjectMethod(node) || t.isClassMethod(node);
    for (const k of keys) {
      const v = (node as unknown as Record<string, unknown>)[k];
      if (Array.isArray(v)) for (const c of v) visit(c as t.Node, inner);
      else visit(v as t.Node, inner);
    }
  };
  for (const p of fn.params) visit(p, false);
  visit(fn.body, false);
  return found;
}

/** @experimental */
export function functionExpressionAsArrow(fn: t.FunctionExpression): t.ArrowFunctionExpression | null {
  if (fn.generator || fn.id != null || usesOwnFunctionScope(fn)) return null;
  const arrow = t.arrowFunctionExpression(fn.params, fn.body, fn.async);
  arrow.returnType = fn.returnType ?? null;
  arrow.typeParameters = (fn.typeParameters as t.TSTypeParameterDeclaration | null | undefined) ?? null;
  arrow.leadingComments = fn.leadingComments ?? null;
  arrow.trailingComments = fn.trailingComments ?? null;
  arrow.innerComments = fn.innerComments ?? null;
  return arrow;
}
