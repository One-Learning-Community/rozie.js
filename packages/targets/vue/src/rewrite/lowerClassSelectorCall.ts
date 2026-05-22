/**
 * lowerClassSelectorCall — Phase 13 Plan 13-03 (Vue target).
 *
 * Lowers a `$classSelector('<class>')` `CallExpression` to Vue's compile-time
 * CSS-selector form: the string literal `".<class>"`.
 *
 * Vue keeps authored class names LITERAL in the emitted DOM (style isolation
 * via a `[data-rozie-s-<hash>]` attribute, not class-name hashing), so a class
 * passed to a third-party engine matches the rendered DOM as written. The
 * helper therefore lowers to a plain `StringLiteral` — no runtime lookup.
 * (React is the lone exception — it lowers to a runtime `"." + styles.<class>`
 * expression because CSS Modules hash its class names.)
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
 * with the literal `".<class>"` and return `true`. Returns `false` (and does
 * nothing) for any other call shape — keeping the rewrite total.
 *
 * The IR validator (Plan 13-02) already guarantees a single string-literal
 * argument (R3/R5), but the defensive `t.isStringLiteral` narrowing keeps this
 * helper safe even if it is reached for a malformed AST.
 *
 * `quoteStyle` controls how `@babel/generator` serializes the emitted literal:
 *   - `'double'` (default) — `".grip"`, used in the `<script>` path.
 *   - `'single'` — `'.grip'`, used in the template-attribute path. A Vue
 *     `:attr="..."` binding double-quotes its expression; a double-quoted
 *     string literal inside it would collide and produce `:attr="".grip""`.
 *     Forcing single quotes via `extra.raw` keeps the attribute well-formed.
 */
export function lowerClassSelectorCall(
  path: NodePath<t.CallExpression>,
  quoteStyle: 'single' | 'double' = 'double',
): boolean {
  const callee = path.node.callee;
  if (!t.isIdentifier(callee) || callee.name !== '$classSelector') return false;

  const args = path.node.arguments;
  if (args.length === 1 && t.isStringLiteral(args[0])) {
    const cls = (args[0] as t.StringLiteral).value;
    // ".grip"
    const literal = t.stringLiteral('.' + cls);
    if (quoteStyle === 'single') {
      // Force single-quote serialization so the literal does not collide with
      // the double-quoted `:attr="..."` template-binding wrapper.
      literal.extra = { raw: `'${literal.value}'`, rawValue: literal.value };
    }
    path.replaceWith(literal);
  }
  return true;
}
