/**
 * lowerClassSelectorCall — Phase 13 Plan 13-03 (React target).
 * Phase 25 Plan 25-01 — REWRITTEN: lowers to a static `"." + "x"` selector.
 *
 * Lowers a `$classSelector('<class>')` `CallExpression` to the compile-time
 * CSS-selector form `"." + "<class>"`.
 *
 * React class names are no longer hashed (Phase 25). React used to route scoped
 * `<style>` through CSS Modules, which hashed `className={styles.grip}` to a
 * runtime `_grip_17x98_26`, so a literal `".grip"` could not match the rendered
 * DOM — hence the old `"." + styles.grip` runtime lowering. After Phase 25,
 * React emits plain attribute-scoped `.css` (the `[data-rozie-s-HASH]` attribute
 * is the sole isolation layer), so the rendered class name is the un-hashed
 * `grip` and a static `".grip"` matches directly. React now lowers identically
 * to the other five targets — `$classSelector` is a convenience, not a necessity.
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
 * If `path` is a `$classSelector('<string-literal>')` call, replace it in place
 * with the static selector `"." + "<class>"` and return `true`. Returns `false`
 * (and does nothing) for any other call shape — keeping the rewrite total.
 *
 * A hyphenated class (`my-handle`) is now a plain string literal — Phase 25
 * removed the `styles` member-access form (and its identifier-safe / bracket
 * distinction) entirely.
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
    // "." + "grip"   (static compile-time selector; no `styles` dependency)
    path.replaceWith(
      t.binaryExpression('+', t.stringLiteral('.'), t.stringLiteral(cls)),
    );
  }
  return true;
}
