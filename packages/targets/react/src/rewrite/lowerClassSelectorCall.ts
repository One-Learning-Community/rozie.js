/**
 * lowerClassSelectorCall — Phase 13 Plan 13-03 (React target).
 *
 * Lowers a `$classSelector('<class>')` `CallExpression` to React's runtime
 * CSS-selector form `"." + styles.<class>`.
 *
 * React runs authored class names through CSS Modules
 * (`className={styles.grip}` → a hashed `_grip_17x98_26` at runtime), so a
 * literal `".grip"` would never match the rendered DOM. React is the lone
 * exception among the six targets: it must lower to a RUNTIME expression that
 * resolves to the hashed selector. `styles` is a module-scoped CSS-Modules
 * import emitted whenever the component has a scoped `<style>` block — and a
 * valid `$classSelector` call always implies a scoped class exists (R4), so
 * `styles` is always in scope at a valid call site (D-03).
 *
 * Both rewrite hooks — `rewriteScript.ts` (the `<script>` path) and
 * `rewriteTemplateExpression.ts` (the template-attribute path) — call THIS
 * single helper so the two cannot drift (Pitfall 4).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';

/**
 * Identifier-safe class-name test — copied verbatim from
 * `renderStaticClassLookup` (`emit/emitTemplateAttribute.ts`) so
 * `$classSelector`'s React output matches how `:class` already emits `styles`
 * lookups. A hyphenated class (`my-handle`) is a valid CSS class but
 * `styles.my-handle` is a TS parse error — those MUST use computed member
 * access `styles['my-handle']` (Pitfall 3).
 */
const ID_SAFE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * If `path` is a `$classSelector('<string-literal>')` call, replace it in place
 * with `"." + styles.<class>` and return `true`. Returns `false` (and does
 * nothing) for any other call shape — keeping the rewrite total.
 *
 * The IR validator (Plan 13-02) already guarantees a single string-literal
 * argument (R3/R5), but the defensive `t.isStringLiteral` narrowing keeps this
 * helper safe even if it is reached for a malformed AST.
 */
export function lowerClassSelectorCall(path: NodePath<t.CallExpression>): boolean {
  const callee = path.node.callee;
  if (!t.isIdentifier(callee) || callee.name !== '$classSelector') return false;

  const args = path.node.arguments;
  if (args.length === 1 && t.isStringLiteral(args[0])) {
    const cls = (args[0] as t.StringLiteral).value;
    const stylesLookup = ID_SAFE.test(cls)
      ? t.memberExpression(t.identifier('styles'), t.identifier(cls))
      : t.memberExpression(t.identifier('styles'), t.stringLiteral(cls), true);
    // "." + styles.grip   (or   "." + styles['my-handle'])
    path.replaceWith(t.binaryExpression('+', t.stringLiteral('.'), stylesLookup));
  }
  return true;
}
